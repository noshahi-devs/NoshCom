using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Configuration;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.Extensions;
using Abp;
using Abp.Runtime.Session;
using Abp.UI;
using Elicom.Authorization;
using Elicom.Authorization.Users;
using Elicom.Cards;
using Elicom.Configuration;
using Elicom.Entities;
using Elicom.Withdrawals.Dto;
using Elicom.Wallets;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Linq;
using System.Threading.Tasks;
using System;
using System.Text.RegularExpressions;

namespace Elicom.Withdrawals
{
    [AbpAuthorize]
    public class SmartStoreWithdrawAppService : ElicomAppServiceBase, ISmartStoreWithdrawAppService
    {
        private readonly IRepository<WithdrawRequest, long> _withdrawRepository;
        private readonly ISmartStoreWalletManager _smartStoreWalletManager;
        private readonly IRepository<VirtualCard, long> _cardRepository;
        private readonly IRepository<AppTransaction, long> _transactionRepository;
        private readonly IWalletManager _walletManager;
        private readonly IRepository<Store, Guid> _storeRepository;
        private readonly IRepository<User, long> _userRepository;
        private readonly IRepository<SmartStoreWallet, Guid> _walletRepo;

        public SmartStoreWithdrawAppService(
            IRepository<WithdrawRequest, long> withdrawRepository,
            ISmartStoreWalletManager smartStoreWalletManager,
            IRepository<VirtualCard, long> cardRepository,
            IRepository<AppTransaction, long> transactionRepository,
            IWalletManager walletManager,
            IRepository<Store, Guid> storeRepository,
            IRepository<User, long> userRepository,
            IRepository<SmartStoreWallet, Guid> walletRepo)
        {
            _withdrawRepository = withdrawRepository;
            _smartStoreWalletManager = smartStoreWalletManager;
            _cardRepository = cardRepository;
            _transactionRepository = transactionRepository;
            _walletManager = walletManager;
            _storeRepository = storeRepository;
            _userRepository = userRepository;
            _walletRepo = walletRepo;
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Seller)]
        public async Task<SellerPayoutMethodDto> GetMyPayoutMethod()
        {
            var setting = await GetSavedPayoutMethodSettingAsync();
            return await ToPayoutMethodDtoAsync(setting);
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Seller)]
        public async Task<SellerPayoutMethodDto> SaveMyPayoutMethod(SaveSellerPayoutMethodInput input)
        {
            if (input == null)
            {
                throw new UserFriendlyException("Invalid payout method payload.");
            }

            var methodKey = (input.MethodKey ?? string.Empty).Trim().ToLowerInvariant();
            if (methodKey.IsNullOrWhiteSpace())
            {
                throw new UserFriendlyException("Please select a payment method.");
            }

            var setting = new SellerPayoutMethodSetting
            {
                MethodKey = methodKey,
                Country = (input.Country ?? string.Empty).Trim(),
                AccountType = (input.AccountType ?? string.Empty).Trim(),
                AccountTitle = (input.AccountTitle ?? string.Empty).Trim(),
                BankName = (input.BankName ?? string.Empty).Trim(),
                AccountNumber = DigitsOnly(input.AccountNumber),
                RoutingNumber = (input.RoutingNumber ?? string.Empty).Trim(),
                SwiftCode = (input.SwiftCode ?? string.Empty).Trim(),
                WalletId = (input.WalletId ?? string.Empty).Trim(),
                CardHolderName = (input.CardHolderName ?? string.Empty).Trim(),
                CardNumber = DigitsOnly(input.CardNumber),
                ExpiryDate = (input.ExpiryDate ?? string.Empty).Trim()
            };

            if (methodKey == "easyfinora")
            {
                if (setting.WalletId.IsNullOrWhiteSpace())
                {
                    throw new UserFriendlyException("EasyFinora Wallet ID is required.");
                }
            }
            else if (methodKey == "bank" || methodKey == "wise")
            {
                if (setting.Country.IsNullOrWhiteSpace())
                {
                    throw new UserFriendlyException("Country is required.");
                }

                if (setting.AccountType.IsNullOrWhiteSpace())
                {
                    throw new UserFriendlyException("Account type is required.");
                }

                if (setting.AccountTitle.IsNullOrWhiteSpace() || setting.BankName.IsNullOrWhiteSpace())
                {
                    throw new UserFriendlyException("Account title and bank name are required.");
                }

                if (setting.AccountNumber.IsNullOrWhiteSpace())
                {
                    throw new UserFriendlyException("Account number is required.");
                }
            }
            else if (methodKey == "paypal" || methodKey == "stripe")
            {
                if (setting.WalletId.IsNullOrWhiteSpace())
                {
                    throw new UserFriendlyException("Email/Wallet ID is required for this method.");
                }
            }

            var json = JsonConvert.SerializeObject(setting);
            await SettingManager.ChangeSettingForUserAsync(
                AbpSession.ToUserIdentifier(),
                AppSettingNames.SellerPayoutMethodJson,
                json
            );

            return await ToPayoutMethodDtoAsync(setting);
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Seller)]
        public async Task<WithdrawRequestDto> SubmitWithdrawRequest(CreateWithdrawRequestInput input)
        {
            var userId = AbpSession.GetUserId();

            if (input.Amount <= 0)
            {
                throw new UserFriendlyException("Amount must be positive.");
            }

            var balance = await _smartStoreWalletManager.GetBalanceAsync(userId);
            if (balance < input.Amount)
            {
                throw new UserFriendlyException($"Insufficient SmartStore wallet balance. Available: ${balance:F2}, Requested: ${input.Amount:F2}");
            }

            // Enforce admin limits
            var wallet = await _walletRepo.FirstOrDefaultAsync(w => w.UserId == userId);

            if (wallet == null || !wallet.WithdrawLimit.HasValue)
            {
                throw new UserFriendlyException("You cannot withdraw funds at this time. Please wait for admin permission.");
            }

            if (wallet.WithdrawLimit.HasValue && input.Amount > wallet.WithdrawLimit.Value)
            {
                throw new UserFriendlyException($"Withdrawal failed. Your current withdrawal limit set by admin is ${wallet.WithdrawLimit.Value:F2}.");
            }

            if (wallet.WithdrawAllowedUntil.HasValue && DateTime.Now < wallet.WithdrawAllowedUntil.Value)
            {
                throw new UserFriendlyException($"[VER-DEBUG-01] Withdrawal protocol is still active. Please wait until {wallet.WithdrawAllowedUntil.Value:dd MMM, yyyy hh:mm tt}.");
            }

            var methodKey = (input.Method ?? string.Empty).Trim().ToLowerInvariant();
            if (methodKey == "easyfinora")
            {
                var walletId = ExtractWalletId(input.PaymentDetails);
                if (walletId.IsNullOrWhiteSpace())
                {
                    throw new UserFriendlyException("EasyFinora Wallet ID is required in payout details.");
                }

                var recipientUser = await FindUserByWalletIdAsync(walletId);
                if (recipientUser == null)
                {
                    throw new UserFriendlyException("EasyFinora Wallet ID not found.");
                }

                var hasActiveCard = await HasAnyActiveCardAsync(recipientUser.Id);
                if (!hasActiveCard)
                {
                    throw new UserFriendlyException("Selected EasyFinora account is not verified by admin.");
                }
            }

            var request = new WithdrawRequest
            {
                TenantId = AbpSession.GetTenantId(),
                UserId = userId,
                CardId = 0,
                Amount = input.Amount,
                Method = string.IsNullOrWhiteSpace(input.Method) ? "Bank Transfer" : input.Method,
                PaymentDetails = string.IsNullOrWhiteSpace(input.PaymentDetails) ? "Seller requested payout" : input.PaymentDetails,
                LocalAmount = input.LocalAmount,
                LocalCurrency = string.IsNullOrWhiteSpace(input.LocalCurrency) ? "USD" : input.LocalCurrency,
                Status = "Pending"
            };

            var id = await _withdrawRepository.InsertAndGetIdAsync(request);

            var held = await _smartStoreWalletManager.TryHoldAsync(
                userId,
                request.Amount,
                request.Id.ToString(),
                $"Withdrawal request #{request.Id} pending"
            );

            if (!held)
            {
                throw new UserFriendlyException("Insufficient SmartStore wallet balance for this withdrawal.");
            }

            // Deduct from limit
            if (wallet.WithdrawLimit.HasValue)
            {
                wallet.WithdrawLimit = Math.Max(0, wallet.WithdrawLimit.Value - request.Amount);
                await _walletRepo.UpdateAsync(wallet);
            }

            return new WithdrawRequestDto
            {
                Id = id,
                UserId = userId,
                CardId = 0,
                Amount = request.Amount,
                Method = request.Method,
                PaymentDetails = request.PaymentDetails,
                Status = request.Status,
                CreationTime = request.CreationTime
            };
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Seller)]
        public async Task<PagedResultDto<WithdrawRequestDto>> GetMyWithdrawRequests(PagedAndSortedResultRequestDto input)
        {
            var userId = AbpSession.GetUserId();
            var query = _withdrawRepository.GetAll().Where(r => r.UserId == userId);

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreationTime)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount)
                .ToListAsync();

            return new PagedResultDto<WithdrawRequestDto>(
                totalCount,
                items.Select(r => new WithdrawRequestDto
                {
                    Id = r.Id,
                    UserId = r.UserId,
                    CardId = r.CardId,
                    Amount = r.Amount,
                    Method = r.Method,
                    PaymentDetails = r.PaymentDetails,
                    Status = r.Status,
                    AdminRemarks = r.AdminRemarks,
                    LocalAmount = r.LocalAmount,
                    LocalCurrency = r.LocalCurrency,
                    PaymentProof = r.PaymentProof,
                    CreationTime = r.CreationTime
                }).ToList()
            );
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin)]
        public async Task<PagedResultDto<WithdrawRequestDto>> GetAllWithdrawRequests(PagedAndSortedResultRequestDto input)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MustHaveTenant))
            {
                var query = _withdrawRepository.GetAll().Include(r => r.User);

                var totalCount = await query.CountAsync();
                var items = await query
                    .OrderByDescending(r => r.CreationTime)
                    .Skip(input.SkipCount)
                    .Take(input.MaxResultCount)
                    .ToListAsync();

                var ownerIds = items.Select(i => i.UserId).Distinct().ToList();
                var storeNamesByOwner = await _storeRepository.GetAll()
                    .Where(s => ownerIds.Contains(s.OwnerId))
                    .GroupBy(s => s.OwnerId)
                    .Select(g => new { OwnerId = g.Key, Name = g.Select(x => x.Name).FirstOrDefault() })
                    .ToDictionaryAsync(x => x.OwnerId, x => x.Name);

                return new PagedResultDto<WithdrawRequestDto>(
                    totalCount,
                    items.Select(r => new WithdrawRequestDto
                    {
                        Id = r.Id,
                        UserId = r.UserId,
                        UserName = storeNamesByOwner.TryGetValue(r.UserId, out var storeName) && !storeName.IsNullOrWhiteSpace()
                            ? storeName
                            : (r.User != null
                                ? (string.IsNullOrWhiteSpace(string.Join(" ", new[] { r.User.Name, r.User.Surname }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim())
                                    ? r.User.UserName
                                    : string.Join(" ", new[] { r.User.Name, r.User.Surname }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim())
                                : "Unknown"),
                        CardId = r.CardId,
                        Amount = r.Amount,
                        Method = r.Method,
                        PaymentDetails = r.PaymentDetails,
                        Status = r.Status,
                        AdminRemarks = r.AdminRemarks,
                        LocalAmount = r.LocalAmount,
                        LocalCurrency = r.LocalCurrency,
                        HasProof = !string.IsNullOrEmpty(r.PaymentProof),
                        PaymentProof = null,
                        CreationTime = r.CreationTime
                    }).ToList()
                );
            }
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin)]
        public async Task ApproveWithdraw(ApproveWithdrawRequestInput input)
        {
            var request = await _withdrawRepository.GetAsync(input.Id);
            if (request.Status != "Pending")
            {
                throw new UserFriendlyException("Only pending requests can be approved.");
            }

            var isEasyFinoraMethod = IsEasyFinoraMethod(request.Method, request.PaymentDetails);
            var walletId = ExtractWalletId(request.PaymentDetails);
            SellerPayoutMethodSetting payoutSetting = null;
            if (walletId.IsNullOrWhiteSpace() && isEasyFinoraMethod)
            {
                // Backward compatibility: older requests may store only raw wallet id text.
                walletId = ExtractWalletIdFromRaw(request.PaymentDetails);
            }

            if (isEasyFinoraMethod)
            {
                payoutSetting = await GetSavedPayoutMethodSettingAsync(new UserIdentifier(request.TenantId, request.UserId));
                if (walletId.IsNullOrWhiteSpace())
                {
                    walletId = (payoutSetting?.WalletId ?? string.Empty).Trim();
                }
            }

            if (!string.IsNullOrWhiteSpace(walletId))
            {
                var recipientUser = await FindUserByWalletIdAsync(walletId);
                if (recipientUser == null && isEasyFinoraMethod)
                {
                    // Last fallback: default to seller user itself if wallet id could not be resolved.
                    using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
                    {
                        recipientUser = await _userRepository.GetAll()
                            .IgnoreQueryFilters()
                            .FirstOrDefaultAsync(u => u.Id == request.UserId);
                    }
                }

                if (recipientUser == null)
                {
                    throw new UserFriendlyException("Target EasyFinora wallet not found.");
                }

                using (CurrentUnitOfWork.SetTenantId(recipientUser.TenantId))
                {
                    await _walletManager.DepositAsync(
                        recipientUser.Id,
                        request.Amount,
                        request.Id.ToString(),
                        $"SmartStore payout approved to Wallet ID {walletId}"
                    );

                    await _transactionRepository.InsertAsync(new AppTransaction
                    {
                        TenantId = recipientUser.TenantId ?? request.TenantId,
                        UserId = recipientUser.Id,
                        CardId = null,
                        Amount = request.Amount,
                        MovementType = "Credit",
                        Category = "Payout",
                        ReferenceId = request.Id.ToString(),
                        Status = "Approved",
                        Description = $"SmartStore payout approved to Wallet ID {walletId}"
                    });
                }
            }
            else
            {
                if (isEasyFinoraMethod)
                {
                    var candidateCardNumber = payoutSetting?.CardNumber;
                    if (!candidateCardNumber.IsNullOrWhiteSpace())
                    {
                        var candidateCard = await FindEasyFinoraCardAsync(candidateCardNumber);
                        if (candidateCard != null)
                        {
                            using (CurrentUnitOfWork.SetTenantId(candidateCard.TenantId))
                            {
                                await _walletManager.DepositAsync(
                                    candidateCard.UserId,
                                    request.Amount,
                                    request.Id.ToString(),
                                    $"SmartStore payout approved for Card ****{GetLast4(candidateCard.CardNumber)}"
                                );

                                candidateCard.Balance += request.Amount;
                                await _cardRepository.UpdateAsync(candidateCard);

                                await _transactionRepository.InsertAsync(new AppTransaction
                                {
                                    TenantId = candidateCard.TenantId,
                                    UserId = candidateCard.UserId,
                                    CardId = candidateCard.Id,
                                    Amount = request.Amount,
                                    MovementType = "Credit",
                                    Category = "Payout",
                                    ReferenceId = request.Id.ToString(),
                                    Status = "Approved",
                                    Description = $"SmartStore payout approved for Card ****{GetLast4(candidateCard.CardNumber)}"
                                });
                            }

                            request.Status = "Approved";
                            request.AdminRemarks = input.AdminRemarks;
                            request.PaymentProof = input.PaymentProof;

                            await _withdrawRepository.UpdateAsync(request);
                            await _smartStoreWalletManager.UpdateTransactionStatusAsync(
                                request.UserId,
                                request.Id.ToString(),
                                "Completed"
                            );
                            return;
                        }
                    }

                    throw new UserFriendlyException("EasyFinora payout target not found (wallet/card).");
                }

                var cardNumber = ExtractCardNumber(request.PaymentDetails);
                if (string.IsNullOrWhiteSpace(cardNumber))
                {
                    throw new UserFriendlyException("Card number or wallet ID not found in withdrawal details.");
                }

                VirtualCard card;
                using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
                {
                    card = await _cardRepository.GetAll()
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(c => c.CardNumber == cardNumber);
                }

                if (card == null)
                {
                    throw new UserFriendlyException("Target EasyFinora card not found.");
                }

                using (CurrentUnitOfWork.SetTenantId(card.TenantId))
                {
                    // Credit EasyFinora wallet history + balance
                    await _walletManager.DepositAsync(
                        card.UserId,
                        request.Amount,
                        request.Id.ToString(),
                        $"SmartStore payout approved for Card ****{GetLast4(card.CardNumber)}"
                    );

                    // Increase card balance
                    card.Balance += request.Amount;
                    await _cardRepository.UpdateAsync(card);

                    // Record transaction in EasyFinora card ledger
                    await _transactionRepository.InsertAsync(new AppTransaction
                    {
                        TenantId = card.TenantId,
                        UserId = card.UserId,
                        CardId = card.Id,
                        Amount = request.Amount,
                        MovementType = "Credit",
                        Category = "Payout",
                        ReferenceId = request.Id.ToString(),
                        Status = "Approved",
                        Description = $"SmartStore payout approved for Card ****{GetLast4(card.CardNumber)}"
                    });
                }
            }

            request.Status = "Approved";
            request.AdminRemarks = input.AdminRemarks;
            request.PaymentProof = input.PaymentProof;

            await _withdrawRepository.UpdateAsync(request);
            await _smartStoreWalletManager.UpdateTransactionStatusAsync(
                request.UserId,
                request.Id.ToString(),
                "Completed"
            );
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin)]
        public async Task RejectWithdraw(ApproveWithdrawRequestInput input)
        {
            var request = await _withdrawRepository.GetAsync(input.Id);
            if (request.Status != "Pending")
            {
                throw new UserFriendlyException("Only pending requests can be rejected.");
            }

            request.Status = "Rejected";
            request.AdminRemarks = input.AdminRemarks;

            await _withdrawRepository.UpdateAsync(request);
            await _smartStoreWalletManager.UpdateTransactionStatusAsync(
                request.UserId,
                request.Id.ToString(),
                "Failed"
            );

            await _smartStoreWalletManager.CreditAsync(
                request.UserId,
                request.Amount,
                request.Id.ToString(),
                $"Withdrawal request #{request.Id} rejected (refund)",
                movementType: "Refund",
                status: "Completed"
            );
        }

        private static string ExtractCardNumber(string paymentDetails)
        {
            if (string.IsNullOrWhiteSpace(paymentDetails))
            {
                return string.Empty;
            }

            var digits = new string(paymentDetails.Where(char.IsDigit).ToArray());
            if (digits.Length >= 16)
            {
                return digits.Substring(0, 16);
            }

            return string.Empty;
        }

        private static string GetLast4(string cardNumber)
        {
            if (string.IsNullOrWhiteSpace(cardNumber) || cardNumber.Length < 4)
            {
                return cardNumber ?? string.Empty;
            }

            return cardNumber.Substring(cardNumber.Length - 4);
        }

        private async Task<SellerPayoutMethodSetting> GetSavedPayoutMethodSettingAsync()
        {
            return await GetSavedPayoutMethodSettingAsync(AbpSession.ToUserIdentifier());
        }

        private async Task<SellerPayoutMethodSetting> GetSavedPayoutMethodSettingAsync(UserIdentifier userIdentifier)
        {
            var json = await SettingManager.GetSettingValueForUserAsync(
                AppSettingNames.SellerPayoutMethodJson,
                userIdentifier
            );

            if (json.IsNullOrWhiteSpace())
            {
                return new SellerPayoutMethodSetting();
            }

            try
            {
                return JsonConvert.DeserializeObject<SellerPayoutMethodSetting>(json) ?? new SellerPayoutMethodSetting();
            }
            catch
            {
                return new SellerPayoutMethodSetting();
            }
        }

        private async Task<SellerPayoutMethodDto> ToPayoutMethodDtoAsync(SellerPayoutMethodSetting setting)
        {
            setting ??= new SellerPayoutMethodSetting();

            var dto = new SellerPayoutMethodDto
            {
                MethodKey = setting.MethodKey ?? string.Empty,
                MethodLabel = ToMethodLabel(setting.MethodKey),
                Country = setting.Country ?? string.Empty,
                AccountType = setting.AccountType ?? string.Empty,
                AccountTitle = setting.AccountTitle ?? string.Empty,
                BankName = setting.BankName ?? string.Empty,
                AccountNumberMasked = MaskTail(setting.AccountNumber, 4),
                RoutingNumber = setting.RoutingNumber ?? string.Empty,
                SwiftCode = setting.SwiftCode ?? string.Empty,
                WalletId = setting.WalletId ?? string.Empty,
                CardHolderName = setting.CardHolderName ?? string.Empty,
                CardNumberMasked = MaskCard(setting.CardNumber),
                ExpiryDate = setting.ExpiryDate ?? string.Empty,
                PaymentDetails = BuildPaymentDetails(setting)
            };

            if ((setting.MethodKey ?? string.Empty).Equals("easyfinora", StringComparison.OrdinalIgnoreCase))
            {
                var recipientUser = await FindUserByWalletIdAsync(setting.WalletId ?? string.Empty);
                var verified = false;
                if (recipientUser != null)
                {
                    try
                    {
                        verified = await HasAnyActiveCardAsync(recipientUser.Id);
                    }
                    catch
                    {
                        verified = false;
                    }
                }

                if (verified)
                {
                    dto.IsEasyFinoraVerified = true;
                    dto.VerificationMessage = "Verified by EasyFinora admin";
                }
                else
                {
                    dto.IsEasyFinoraVerified = false;
                    dto.VerificationMessage = "Not verified";
                }
            }
            else
            {
                dto.IsEasyFinoraVerified = true;
                dto.VerificationMessage = "Ready";
            }

            return dto;
        }

        private async Task<VirtualCard> FindEasyFinoraCardAsync(string rawCardNumber)
        {
            var cardNumber = DigitsOnly(rawCardNumber);
            if (cardNumber.IsNullOrWhiteSpace()) return null;

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                return await _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(c => c.CardNumber == cardNumber);
            }
        }

        private async Task<User> FindUserByWalletIdAsync(string walletId)
        {
            if (walletId.IsNullOrWhiteSpace()) return null;
            var normalized = walletId.Trim().ToUpperInvariant();

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                return await _userRepository.GetAll()
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(u => u.WalletId != null && u.WalletId.ToUpper() == normalized);
            }
        }

        private async Task<bool> HasAnyActiveCardAsync(long userId)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                return await _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .AnyAsync(c => c.UserId == userId && c.Status != null && c.Status.ToLower() == "active");
            }
        }

        private static bool IsCardVerified(VirtualCard card)
        {
            var status = (card?.Status ?? string.Empty).Trim().ToLowerInvariant();
            return status == "active";
        }

        private static bool IsValidExpiry(string expiryDate)
        {
            if (expiryDate.IsNullOrWhiteSpace()) return false;
            var parts = expiryDate.Split('/');
            if (parts.Length != 2) return false;
            if (!int.TryParse(parts[0], out var month)) return false;
            if (!int.TryParse(parts[1], out var year)) return false;
            return month >= 1 && month <= 12 && year >= 0 && year <= 99;
        }

        private static string DigitsOnly(string value)
        {
            if (value.IsNullOrWhiteSpace()) return string.Empty;
            return new string(value.Where(char.IsDigit).ToArray());
        }

        private static string ToMethodLabel(string methodKey)
        {
            var key = (methodKey ?? string.Empty).Trim().ToLowerInvariant();
            return key switch
            {
                "easyfinora" => "Easy Finora Card",
                "bank" => "Bank Transfer",
                "wise" => "Wise",
                "paypal" => "PayPal",
                "stripe" => "Stripe",
                _ => "Not set"
            };
        }

        private static string BuildPaymentDetails(SellerPayoutMethodSetting setting)
        {
            var key = (setting.MethodKey ?? string.Empty).Trim().ToLowerInvariant();
            return key switch
            {
                "easyfinora" => $"EasyFinora Wallet ID: {setting.WalletId}",
                "bank" or "wise" => $"Country: {setting.Country}; Bank: {setting.BankName}; Account Type: {setting.AccountType}; Account Title: {setting.AccountTitle}; Account: {setting.AccountNumber}; Routing: {setting.RoutingNumber}; Reference: {setting.SwiftCode}",
                "paypal" or "stripe" => $"Wallet ID: {setting.WalletId}",
                _ => string.Empty
            };
        }

        private static string MaskCard(string cardNumber)
        {
            var digits = DigitsOnly(cardNumber);
            if (digits.Length < 4) return string.Empty;
            var last4 = digits.Substring(digits.Length - 4);
            return $"**** **** **** {last4}";
        }

        private static string MaskTail(string value, int visibleTail)
        {
            var digits = DigitsOnly(value);
            if (digits.IsNullOrWhiteSpace()) return string.Empty;
            if (digits.Length <= visibleTail) return digits;
            return $"{new string('*', digits.Length - visibleTail)}{digits.Substring(digits.Length - visibleTail)}";
        }

        private class SellerPayoutMethodSetting
        {
            public string MethodKey { get; set; } = string.Empty;
            public string Country { get; set; } = string.Empty;
            public string AccountType { get; set; } = string.Empty;
            public string AccountTitle { get; set; } = string.Empty;
            public string BankName { get; set; } = string.Empty;
            public string AccountNumber { get; set; } = string.Empty;
            public string RoutingNumber { get; set; } = string.Empty;
            public string SwiftCode { get; set; } = string.Empty;
            public string WalletId { get; set; } = string.Empty;
            public string CardHolderName { get; set; } = string.Empty;
            public string CardNumber { get; set; } = string.Empty;
            public string ExpiryDate { get; set; } = string.Empty;
        }

        private static string ExtractWalletId(string paymentDetails)
        {
            if (paymentDetails.IsNullOrWhiteSpace()) return string.Empty;

            var marker = "wallet id:";
            var idx = paymentDetails.ToLowerInvariant().IndexOf(marker);
            if (idx >= 0)
            {
                var tail = paymentDetails.Substring(idx + marker.Length).Trim();
                var firstPart = tail.Split(';', '|', ',', '\n', '\r').FirstOrDefault()?.Trim();
                return CleanWalletIdToken(firstPart);
            }

            return ExtractWalletIdFromRaw(paymentDetails);
        }

        private static bool IsEasyFinoraMethod(string method, string paymentDetails)
        {
            var normalized = (method ?? string.Empty).Trim().ToLowerInvariant();
            if (normalized == "easyfinora" || normalized.Contains("easy finora"))
            {
                return true;
            }

            var details = (paymentDetails ?? string.Empty).Trim().ToLowerInvariant();
            return details.Contains("easyfinora") || details.Contains("easy finora");
        }

        private static string ExtractWalletIdFromRaw(string paymentDetails)
        {
            if (paymentDetails.IsNullOrWhiteSpace()) return string.Empty;

            var text = paymentDetails.Trim();
            var efMatch = Regex.Match(text, @"\bEF-[A-Z0-9-]{4,}\b", RegexOptions.IgnoreCase);
            if (efMatch.Success)
            {
                return CleanWalletIdToken(efMatch.Value);
            }

            // Fall back to single token payload (legacy/local saves).
            if (!text.Contains(" "))
            {
                return CleanWalletIdToken(text);
            }

            return string.Empty;
        }

        private static string CleanWalletIdToken(string value)
        {
            if (value.IsNullOrWhiteSpace()) return string.Empty;
            return value.Trim().Trim('"', '\'', '.', ',', ';', '|', ':');
        }
    }
}
