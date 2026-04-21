using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.Runtime.Session;
using Abp.UI;
using Elicom.Authorization.Users;
using Elicom.Cards.Dto;
using Elicom.Configuration;

using Elicom.Entities;
using Elicom.Wallets;
using Microsoft.EntityFrameworkCore;

namespace Elicom.Cards
{
    [AbpAuthorize]
    public class CardAppService : ElicomAppServiceBase, ICardAppService
    {
        private readonly IRepository<VirtualCard, long> _cardRepository;
        private readonly IRepository<DepositRequest, Guid> _depositRepository;
        private readonly IRepository<WithdrawRequest, long> _withdrawRepository;
        private readonly IRepository<CardApplication, Guid> _applicationRepository;
        private readonly IWalletManager _walletManager;
        private readonly ISmartStoreWalletManager _smartStoreWalletManager;
        private readonly IRepository<AppTransaction, long> _transactionRepository;

        public CardAppService(
            IRepository<VirtualCard, long> cardRepository,
            IRepository<DepositRequest, Guid> depositRepository,
            IRepository<WithdrawRequest, long> withdrawRepository,
            IRepository<CardApplication, Guid> applicationRepository,
            IWalletManager walletManager,
            ISmartStoreWalletManager smartStoreWalletManager,
            IRepository<AppTransaction, long> transactionRepository)
        {
            _cardRepository = cardRepository;
            _depositRepository = depositRepository;
            _withdrawRepository = withdrawRepository;
            _applicationRepository = applicationRepository;
            _walletManager = walletManager;
            _smartStoreWalletManager = smartStoreWalletManager;
            _transactionRepository = transactionRepository;
        }

        public async Task<UserBalanceDto> GetBalance()
        {
            var userId = AbpSession.GetUserId();

            var totalBalance = await _cardRepository.GetAll()
                .Where(c => c.UserId == userId)
                .SumAsync(c => c.Balance);

            var pendingDeposit = await _depositRepository.GetAll()
                .Where(r => r.UserId == userId && r.Status == "Pending")
                .SumAsync(r => r.Amount);

            var pendingWithdrawal = await _withdrawRepository.GetAll()
                .Where(r => r.UserId == userId && r.Status == "Pending")
                .SumAsync(r => r.Amount);

            return new UserBalanceDto
            {
                TotalBalance = totalBalance,
                PendingDeposit = pendingDeposit,
                PendingWithdrawal = pendingWithdrawal,
                Currency = "USD"
            };
        }

        [AbpAllowAnonymous]
        public async Task<CardValidationResultDto> ValidateCard(ValidateCardInput input)
        {
            // Clean card number (remove spaces)
            var cleanCardNumber = NormalizeCardNumber(input.CardNumber);
            var amount = input.Amount ?? 0m;

            // Cross-tenant lookup: Ignore filters to find the card in any tenant (usually Tenant 3)
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var card = await _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(c =>
                        c.CardNumber == cleanCardNumber ||
                        c.CardNumber.Replace(" ", "").Replace("-", "") == cleanCardNumber);

                if (card == null)
                {
                    return new CardValidationResultDto { IsValid = false, Message = "Card not found." };
                }

                if (card.Cvv != input.Cvv || card.ExpiryDate != input.ExpiryDate)
                {
                    return new CardValidationResultDto { IsValid = false, Message = "Invalid CVV or Expiry Date." };
                }

                if (card.Status != "Active")
                {
                    return new CardValidationResultDto { IsValid = false, Message = $"Card is {card.Status}." };
                }

                var limitError = await ValidateCardTransactionLimitsAsync(card, amount);
                if (!string.IsNullOrWhiteSpace(limitError))
                {
                    return new CardValidationResultDto { IsValid = false, Message = limitError };
                }

                var availableBalance = await GetWalletBalanceAsync(card);
                if (availableBalance < amount)
                {
                    return new CardValidationResultDto 
                    { 
                        IsValid = false, 
                        Message = "Insufficient balance.",
                        AvailableBalance = availableBalance
                    };
                }

                return new CardValidationResultDto 
                { 
                    IsValid = true, 
                    Message = "Card verified successfully.",
                    AvailableBalance = availableBalance
                };
            }
        }

        [AbpAllowAnonymous]
        public async Task ProcessPayment(ProcessCardPaymentInput input)
        {
            var cleanCardNumber = NormalizeCardNumber(input.CardNumber);
            var amount = input.Amount ?? 0m;
            var referenceId = string.IsNullOrWhiteSpace(input.ReferenceId)
                ? $"CARD-{DateTime.Now:yyyyMMddHHmmss}"
                : input.ReferenceId.Trim();
            var paymentDescription = !string.IsNullOrWhiteSpace(input.Description)
                ? input.Description.Trim()
                : BuildCardPaymentDescription(input.SourcePlatform);

            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var card = await _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(c =>
                        c.CardNumber == cleanCardNumber ||
                        c.CardNumber.Replace(" ", "").Replace("-", "") == cleanCardNumber);

                if (card == null || card.Cvv != input.Cvv || card.ExpiryDate != input.ExpiryDate)
                {
                    throw new UserFriendlyException("Verification failed during payment processing.");
                }

                if (amount <= 0m)
                {
                    throw new UserFriendlyException("Payment amount must be greater than zero.");
                }

                var limitError = await ValidateCardTransactionLimitsAsync(card, amount);
                if (!string.IsNullOrWhiteSpace(limitError))
                {
                    throw new UserFriendlyException(limitError);
                }

                // Debit from Wallet instead of Card Balance
                var debited = await TryDebitWalletAsync(card, amount, referenceId, paymentDescription);
                if (!debited)
                {
                    throw new UserFriendlyException("Insufficient balance in the wallet.");
                }

                // Record transaction in AppTransactions for card history
                await _transactionRepository.InsertAsync(new AppTransaction
                {
                    TenantId = card.TenantId,
                    UserId = card.UserId,
                    CardId = card.Id,
                    Amount = -amount,
                    MovementType = "Debit",
                    Category = "Card Transaction",
                    ReferenceId = referenceId,
                    Description = paymentDescription,
                    Status = "Approved"
                });
            }
        }

        public async Task<PurchaseUpgradePlanResultDto> PurchaseUpgradePlan(PurchaseUpgradePlanInput input)
        {
            if (input == null)
            {
                throw new UserFriendlyException("Invalid request.");
            }

            var userId = AbpSession.GetUserId();
            var (planCode, planName, amount) = ResolveUpgradePlan(input.PlanCode);
            var activeSubscriptionCode = await GetActiveSubscriptionCodeAsync();
            var pendingSubscriptionCode = await GetPendingSubscriptionCodeAsync();

            if (string.Equals(planCode, activeSubscriptionCode, StringComparison.OrdinalIgnoreCase))
            {
                throw new UserFriendlyException($"{planName} plan is already active on your card.");
            }

            if (string.Equals(planCode, pendingSubscriptionCode, StringComparison.OrdinalIgnoreCase))
            {
                throw new UserFriendlyException($"{planName} plan is already purchased. Click Apply Now to activate it.");
            }

            var cleanCardNumber = NormalizeCardNumber(input.CardNumber);
            var expiry = NormalizeExpiry(input.ExpiryDate);
            var cvv = NormalizeDigits(input.Cvv);
            var holder = NormalizeHolder(input.HolderName);

            if (string.IsNullOrWhiteSpace(cleanCardNumber) ||
                string.IsNullOrWhiteSpace(expiry) ||
                string.IsNullOrWhiteSpace(cvv) ||
                string.IsNullOrWhiteSpace(holder))
            {
                throw new UserFriendlyException("Card number, expiry date, CVV and user name are required.");
            }

            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var cardQuery = _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .Where(c => c.UserId == userId);

                if (AbpSession.TenantId.HasValue)
                {
                    var tenantId = AbpSession.TenantId.Value;
                    cardQuery = cardQuery.Where(c => c.TenantId == tenantId);
                }

                // Match in-memory after loading user cards to tolerate legacy formatting in DB
                // (e.g. card numbers with spaces/hyphens and holder names with uneven spacing).
                var allUserCards = await cardQuery
                    .OrderByDescending(c => c.CreationTime)
                    .ToListAsync();

                var card = allUserCards.FirstOrDefault(c =>
                    NormalizeCardNumber(c.CardNumber) == cleanCardNumber &&
                    NormalizeExpiry(c.ExpiryDate) == expiry &&
                    NormalizeDigits(c.Cvv) == cvv);

                if (card == null)
                {
                    throw new UserFriendlyException("Card details are invalid. Please use full card number, MM/YY expiry and correct CVV.");
                }

                if (!string.Equals(NormalizeHolder(card.HolderName), holder, StringComparison.OrdinalIgnoreCase))
                {
                    throw new UserFriendlyException("Card holder name does not match.");
                }

                if (string.Equals(card.Status, "Blocked", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(card.Status, "Expired", StringComparison.OrdinalIgnoreCase))
                {
                    throw new UserFriendlyException($"Card is {card.Status}.");
                }

                if (amount > 0m)
                {
                    var referenceId = $"PLAN-{DateTime.UtcNow:yyyyMMddHHmmss}-{userId}";
                    var description = $"Upgrade plan purchase: {planName}";
                    var debited = await TryDebitWalletAsync(card, amount, referenceId, description);
                    if (!debited)
                    {
                        throw new UserFriendlyException("Insufficient balance in Easy Finora wallet.");
                    }

                    await _transactionRepository.InsertAsync(new AppTransaction
                    {
                        TenantId = card.TenantId,
                        UserId = card.UserId,
                        CardId = card.Id,
                        Amount = -amount,
                        MovementType = "Debit",
                        Category = "Plan Upgrade",
                        ReferenceId = referenceId,
                        Description = description,
                        Status = "Approved"
                    });
                }

                // Keep only selected card active for the user.
                var userCardsForStatus = await _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .Where(c => c.UserId == userId)
                    .ToListAsync();

                foreach (var userCard in userCardsForStatus)
                {
                    var nextStatus = userCard.Id == card.Id ? "Active" : "Inactive";
                    if (!string.Equals(userCard.Status, nextStatus, StringComparison.OrdinalIgnoreCase))
                    {
                        userCard.Status = nextStatus;
                        await _cardRepository.UpdateAsync(userCard);
                    }
                }

                // Purchase should activate immediately for the selected card.
                await SetActiveSubscriptionCodeAsync(planCode);
                await SetPendingSubscriptionCodeAsync(string.Empty);
                activeSubscriptionCode = await GetActiveSubscriptionCodeAsync();
                pendingSubscriptionCode = await GetPendingSubscriptionCodeAsync();

                var remaining = await GetWalletBalanceAsync(card);
                return new PurchaseUpgradePlanResultDto
                {
                    PlanName = planName,
                    PlanCode = planCode,
                    AmountCharged = amount,
                    CardId = card.Id,
                    CardNumber = FormatCardNumber(card.CardNumber),
                    CardStatus = "Active",
                    RemainingWalletBalance = remaining,
                    ActiveSubscriptionCode = activeSubscriptionCode,
                    ActiveSubscription = GetPlanDisplayName(activeSubscriptionCode),
                    PendingSubscriptionCode = pendingSubscriptionCode,
                    PendingSubscription = GetPlanDisplayName(pendingSubscriptionCode),
                    Message = amount <= 0m
                        ? $"{planName} plan activated successfully."
                        : $"{planName} plan purchased and activated successfully."
                };
            }
        }

        public async Task<PurchaseUpgradePlanResultDto> ApplyUpgradePlan(ApplyUpgradePlanInput input)
        {
            if (input == null || string.IsNullOrWhiteSpace(input.PlanCode))
            {
                throw new UserFriendlyException("Invalid plan selection.");
            }

            var userId = AbpSession.GetUserId();
            var (requestedPlanCode, requestedPlanName, _) = ResolveUpgradePlan(input.PlanCode);
            var pendingSubscriptionCode = await GetPendingSubscriptionCodeAsync();
            var activeSubscriptionCode = await GetActiveSubscriptionCodeAsync();

            // Free plan can be switched instantly by user choice (no purchase requirement).
            if (string.Equals(requestedPlanCode, "free", StringComparison.OrdinalIgnoreCase))
            {
                using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
                {
                    var cardQuery = _cardRepository.GetAll()
                        .IgnoreQueryFilters()
                        .Where(c => c.UserId == userId);

                    if (AbpSession.TenantId.HasValue)
                    {
                        var tenantId = AbpSession.TenantId.Value;
                        cardQuery = cardQuery.Where(c => c.TenantId == tenantId);
                    }

                    var allUserCards = await cardQuery
                        .OrderByDescending(c => c.CreationTime)
                        .ToListAsync();

                    var selectedCard = allUserCards.FirstOrDefault(c =>
                        string.Equals(c.Status, "Active", StringComparison.OrdinalIgnoreCase)) ?? allUserCards.FirstOrDefault();

                    if (selectedCard != null)
                    {
                        foreach (var userCard in allUserCards)
                        {
                            var nextStatus = userCard.Id == selectedCard.Id ? "Active" : "Inactive";
                            if (!string.Equals(userCard.Status, nextStatus, StringComparison.OrdinalIgnoreCase))
                            {
                                userCard.Status = nextStatus;
                                await _cardRepository.UpdateAsync(userCard);
                            }
                        }
                    }

                    await SetActiveSubscriptionCodeAsync("free");
                    await SetPendingSubscriptionCodeAsync(string.Empty);

                    activeSubscriptionCode = await GetActiveSubscriptionCodeAsync();
                    pendingSubscriptionCode = await GetPendingSubscriptionCodeAsync();

                    var remaining = selectedCard != null
                        ? await GetWalletBalanceAsync(selectedCard)
                        : 0m;

                    return new PurchaseUpgradePlanResultDto
                    {
                        PlanName = GetPlanDisplayName(activeSubscriptionCode),
                        PlanCode = activeSubscriptionCode,
                        AmountCharged = 0m,
                        CardId = selectedCard?.Id ?? 0,
                        CardNumber = selectedCard != null ? FormatCardNumber(selectedCard.CardNumber) : string.Empty,
                        CardStatus = selectedCard?.Status ?? "Inactive",
                        RemainingWalletBalance = remaining,
                        ActiveSubscriptionCode = activeSubscriptionCode,
                        ActiveSubscription = GetPlanDisplayName(activeSubscriptionCode),
                        PendingSubscriptionCode = pendingSubscriptionCode,
                        PendingSubscription = GetPlanDisplayName(pendingSubscriptionCode),
                        Message = "Free plan applied successfully."
                    };
                }
            }

            if (string.IsNullOrWhiteSpace(pendingSubscriptionCode))
            {
                if (string.Equals(requestedPlanCode, activeSubscriptionCode, StringComparison.OrdinalIgnoreCase))
                {
                    throw new UserFriendlyException($"{requestedPlanName} is already active.");
                }

                throw new UserFriendlyException("No purchased plan available to apply. Purchase a plan first.");
            }

            if (!string.Equals(requestedPlanCode, pendingSubscriptionCode, StringComparison.OrdinalIgnoreCase))
            {
                throw new UserFriendlyException($"Pending plan is {GetPlanDisplayName(pendingSubscriptionCode)}. Please apply that plan.");
            }

            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var cardQuery = _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .Where(c => c.UserId == userId);

                if (AbpSession.TenantId.HasValue)
                {
                    var tenantId = AbpSession.TenantId.Value;
                    cardQuery = cardQuery.Where(c => c.TenantId == tenantId);
                }

                var allUserCards = await cardQuery
                    .OrderByDescending(c => c.CreationTime)
                    .ToListAsync();

                if (allUserCards.Count == 0)
                {
                    throw new UserFriendlyException("No card found to apply this plan.");
                }

                var selectedCard = allUserCards.FirstOrDefault(c =>
                    string.Equals(c.Status, "Active", StringComparison.OrdinalIgnoreCase)) ?? allUserCards[0];

                foreach (var userCard in allUserCards)
                {
                    var nextStatus = userCard.Id == selectedCard.Id ? "Active" : "Inactive";
                    if (!string.Equals(userCard.Status, nextStatus, StringComparison.OrdinalIgnoreCase))
                    {
                        userCard.Status = nextStatus;
                        await _cardRepository.UpdateAsync(userCard);
                    }
                }

                await SetActiveSubscriptionCodeAsync(requestedPlanCode);
                await SetPendingSubscriptionCodeAsync(string.Empty);

                activeSubscriptionCode = await GetActiveSubscriptionCodeAsync();
                pendingSubscriptionCode = await GetPendingSubscriptionCodeAsync();
                var remaining = await GetWalletBalanceAsync(selectedCard);

                return new PurchaseUpgradePlanResultDto
                {
                    PlanName = GetPlanDisplayName(activeSubscriptionCode),
                    PlanCode = activeSubscriptionCode,
                    AmountCharged = 0m,
                    CardId = selectedCard.Id,
                    CardNumber = FormatCardNumber(selectedCard.CardNumber),
                    CardStatus = "Active",
                    RemainingWalletBalance = remaining,
                    ActiveSubscriptionCode = activeSubscriptionCode,
                    ActiveSubscription = GetPlanDisplayName(activeSubscriptionCode),
                    PendingSubscriptionCode = pendingSubscriptionCode,
                    PendingSubscription = GetPlanDisplayName(pendingSubscriptionCode),
                    Message = $"{GetPlanDisplayName(activeSubscriptionCode)} plan applied successfully."
                };
            }
        }

        public async Task<CardUsageOverviewDto> GetCardUsageOverview(long cardId)
        {
            var userId = AbpSession.GetUserId();

            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var cardQuery = _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .Where(c => c.Id == cardId && c.UserId == userId);

                if (AbpSession.TenantId.HasValue)
                {
                    var tenantId = AbpSession.TenantId.Value;
                    cardQuery = cardQuery.Where(c => c.TenantId == tenantId);
                }

                var card = await cardQuery.FirstOrDefaultAsync();
                if (card == null)
                {
                    throw new UserFriendlyException("Card not found.");
                }

                var activePlanCode = await GetActiveSubscriptionCodeAsync(card.TenantId, card.UserId);
                var limits = GetSubscriptionLimit(activePlanCode);
                var nowUtc = DateTime.UtcNow;
                var dayStartUtc = nowUtc.Date;
                var monthStartUtc = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

                var txQuery = _transactionRepository.GetAll()
                    .IgnoreQueryFilters()
                    .Where(t =>
                        t.TenantId == card.TenantId &&
                        t.UserId == card.UserId &&
                        t.CardId == card.Id &&
                        t.MovementType == "Debit" &&
                        t.Category == "Card Transaction" &&
                        t.Status == "Approved");

                var dailyCount = await txQuery
                    .Where(t => t.CreationTime >= dayStartUtc)
                    .CountAsync();

                var monthlyCount = await txQuery
                    .Where(t => t.CreationTime >= monthStartUtc)
                    .CountAsync();

                var dailyAmountUsed = Math.Abs((await txQuery
                    .Where(t => t.CreationTime >= dayStartUtc)
                    .SumAsync(t => (decimal?)t.Amount)) ?? 0m);

                var monthlyAmountUsed = Math.Abs((await txQuery
                    .Where(t => t.CreationTime >= monthStartUtc)
                    .SumAsync(t => (decimal?)t.Amount)) ?? 0m);

                return new CardUsageOverviewDto
                {
                    CardId = card.Id,
                    PlanCode = activePlanCode,
                    PlanName = limits.PlanName,
                    DailyTransactionLimit = limits.TransactionsPerDay,
                    DailyTransactionUsed = dailyCount,
                    DailyTransactionRemaining = Math.Max(0, limits.TransactionsPerDay - dailyCount),
                    MonthlyTransactionLimit = limits.TransactionsPerMonth,
                    MonthlyTransactionUsed = monthlyCount,
                    MonthlyTransactionRemaining = Math.Max(0, limits.TransactionsPerMonth - monthlyCount),
                    DailyAmountLimit = limits.DailyAmountLimit,
                    DailyAmountUsed = dailyAmountUsed,
                    DailyAmountRemaining = Math.Max(0m, limits.DailyAmountLimit - dailyAmountUsed),
                    MonthlyAmountLimit = limits.MonthlyAmountLimit,
                    MonthlyAmountUsed = monthlyAmountUsed,
                    MonthlyAmountRemaining = Math.Max(0m, limits.MonthlyAmountLimit - monthlyAmountUsed),
                    UsageDayStartUtc = dayStartUtc,
                    UsageMonthStartUtc = monthStartUtc,
                    NextDailyResetUtc = dayStartUtc.AddDays(1),
                    NextMonthlyResetUtc = monthStartUtc.AddMonths(1)
                };
            }
        }

        public async Task<VirtualCardDto> CreateVirtualCard(CreateVirtualCardInput input)
        {
            // Validate card type
            if (!Enum.IsDefined(typeof(CardType), input.CardType))
            {
                throw new UserFriendlyException("Invalid card type.");
            }

            // Get current user
            var user = await UserManager.GetUserByIdAsync(AbpSession.GetUserId());

            // Generate card details
            var card = new VirtualCard
            {
                UserId = user.Id,
                CardNumber = GenerateCardNumber(input.CardType),
                CardType = input.CardType,
                HolderName = $"{user.Name} {user.Surname}".ToUpper(),
                ExpiryDate = DateTime.Now.AddYears(3).ToString("MM/yy"),
                Cvv = GenerateCVV(),
                Balance = 0,
                Currency = "USD",
                Status = "Active"
            };

            // Save to database
            var cardId = await _cardRepository.InsertAndGetIdAsync(card);
            var activeSubscriptionCode = await GetActiveSubscriptionCodeAsync();
            var pendingSubscriptionCode = await GetPendingSubscriptionCodeAsync();

            // Map to DTO
            return new VirtualCardDto
            {
                CardId = cardId,
                CardNumber = FormatCardNumber(card.CardNumber),
                CardType = card.CardType,
                HolderName = card.HolderName,
                ExpiryDate = card.ExpiryDate,
                Cvv = card.Cvv,
                Balance = card.Balance,
                Currency = card.Currency,
                Status = card.Status,
                ActiveSubscriptionCode = activeSubscriptionCode,
                ActiveSubscription = GetPlanDisplayName(activeSubscriptionCode),
                PendingSubscriptionCode = pendingSubscriptionCode,
                PendingSubscription = GetPlanDisplayName(pendingSubscriptionCode)
            };
        }

        public async Task<List<VirtualCardDto>> GetUserCards()
        {
            var userId = AbpSession.GetUserId();
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var cardQuery = _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .Where(c => c.UserId == userId);

                if (AbpSession.TenantId.HasValue)
                {
                    var tenantId = AbpSession.TenantId.Value;
                    cardQuery = cardQuery.Where(c => c.TenantId == tenantId);
                }

                var cards = await cardQuery
                    .OrderByDescending(c => c.CreationTime)
                    .ToListAsync();
                var activeSubscriptionCode = await GetActiveSubscriptionCodeAsync();
                var pendingSubscriptionCode = await GetPendingSubscriptionCodeAsync();

                // Mask card numbers for security and map to DTO
                var dtos = cards.Select(card => new VirtualCardDto
                {
                    CardId = card.Id,
                    CardNumber = MaskCardNumber(FormatCardNumber(card.CardNumber)),
                    CardType = card.CardType,
                    HolderName = card.HolderName,
                    ExpiryDate = card.ExpiryDate,
                    Cvv = "***", // Hide CVV in list view
                    Balance = card.Balance,
                    Currency = card.Currency,
                    Status = card.Status,
                    ActiveSubscriptionCode = activeSubscriptionCode,
                    ActiveSubscription = GetPlanDisplayName(activeSubscriptionCode),
                    PendingSubscriptionCode = pendingSubscriptionCode,
                    PendingSubscription = GetPlanDisplayName(pendingSubscriptionCode)
                }).ToList();

                return dtos;
            }
        }

        public async Task<VirtualCardDto> GetCardSensitiveDetails(long cardId)
        {
            var userId = AbpSession.GetUserId();
            VirtualCard card;
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var cardQuery = _cardRepository.GetAll()
                    .IgnoreQueryFilters()
                    .Where(c => c.Id == cardId && c.UserId == userId);

                if (AbpSession.TenantId.HasValue)
                {
                    var tenantId = AbpSession.TenantId.Value;
                    cardQuery = cardQuery.Where(c => c.TenantId == tenantId);
                }

                card = await cardQuery.FirstOrDefaultAsync();
                if (card == null)
                {
                    throw new UserFriendlyException("Card not found or unauthorized access.");
                }
            }

            var activeSubscriptionCode = await GetActiveSubscriptionCodeAsync();
            var pendingSubscriptionCode = await GetPendingSubscriptionCodeAsync();

            return new VirtualCardDto
            {
                CardId = card.Id,
                CardNumber = FormatCardNumber(card.CardNumber), // FULL
                CardType = card.CardType,
                HolderName = card.HolderName,
                ExpiryDate = card.ExpiryDate,
                Cvv = card.Cvv, // FULL
                Balance = card.Balance,
                Currency = card.Currency,
                Status = card.Status,
                ActiveSubscriptionCode = activeSubscriptionCode,
                ActiveSubscription = GetPlanDisplayName(activeSubscriptionCode),
                PendingSubscriptionCode = pendingSubscriptionCode,
                PendingSubscription = GetPlanDisplayName(pendingSubscriptionCode)
            };
        }


        public async Task<CardApplicationDto> SubmitCardApplication(SubmitCardApplicationInput input)
        {
            var userId = AbpSession.GetUserId();
            
            // Check if there is already a pending application
            var existingPending = await _applicationRepository.FirstOrDefaultAsync(x => x.UserId == userId && x.Status == CardApplicationStatus.Pending);
            if (existingPending != null)
            {
                throw new UserFriendlyException("You already have a pending card application.");
            }

            // Validate inputs
            if (string.IsNullOrWhiteSpace(input.FullName) || input.FullName.Length < 3)
                throw new UserFriendlyException("Full name must be at least 3 characters");

            if (string.IsNullOrWhiteSpace(input.ContactNumber) || input.ContactNumber.Length < 10)
                throw new UserFriendlyException("Contact number must be at least 10 digits");

            if (string.IsNullOrWhiteSpace(input.Address) || input.Address.Length < 10)
                throw new UserFriendlyException("Address must be at least 10 characters");

            if (!Enum.IsDefined(typeof(CardType), input.CardType))
                throw new UserFriendlyException("Invalid card type");

            if (string.IsNullOrWhiteSpace(input.DocumentBase64))
                throw new UserFriendlyException("Document is required");

            if (input.DocumentType != null && !new[] { "pdf", "jpg", "jpeg", "png" }.Contains(input.DocumentType.ToLower()))
                throw new UserFriendlyException("Document must be PDF, JPG, JPEG, or PNG");

            // Deactivate any currently active cards (only one active card is allowed)
            var activeCards = await _cardRepository.GetAll()
                .Where(c => c.UserId == userId && c.Status == "Active")
                .OrderByDescending(c => c.CreationTime)
                .ToListAsync();

            long? previousCardId = null;
            if (activeCards.Count > 0)
            {
                previousCardId = activeCards[0].Id;
                foreach (var activeCard in activeCards)
                {
                    activeCard.Status = "Inactive";
                    await _cardRepository.UpdateAsync(activeCard);
                }
            }

            var application = new CardApplication
            {
                UserId = userId,
                TenantId = AbpSession.TenantId ?? 1,
                FullName = input.FullName.Trim(),
                ContactNumber = input.ContactNumber.Trim(),
                Address = input.Address.Trim(),
                CardType = input.CardType,
                DocumentBase64 = input.DocumentBase64,
                DocumentType = input.DocumentType?.ToLower(),
                Status = CardApplicationStatus.Pending,
                AppliedDate = DateTime.UtcNow,
                PreviousCardId = previousCardId
            };

            var applicationId = await _applicationRepository.InsertAndGetIdAsync(application);

            return new CardApplicationDto
            {
                Id = applicationId,
                FullName = application.FullName,
                ContactNumber = application.ContactNumber,
                Address = application.Address,
                CardType = application.CardType,
                DocumentType = application.DocumentType,
                Status = application.Status.ToString(),
                AppliedDate = application.AppliedDate
            };
        }

        public async Task<List<CardApplicationDto>> GetMyApplications()
        {
            var userId = AbpSession.GetUserId();
            var applications = await (from app in _applicationRepository.GetAll()
                                      join card in _cardRepository.GetAll() on app.GeneratedCardId equals card.Id into cardJoin
                                      from card in cardJoin.DefaultIfEmpty()
                                      where app.UserId == userId
                                      orderby app.CreationTime descending
                                      select new CardApplicationDto
                                      {
                                          Id = app.Id,
                                          FullName = app.FullName,
                                          ContactNumber = app.ContactNumber,
                                          Address = app.Address,
                                          CardType = app.CardType,
                                          DocumentType = app.DocumentType,
                                          Status = app.Status.ToString(),
                                          AppliedDate = app.AppliedDate,
                                          ReviewedDate = app.ReviewedDate,
                                          ReviewNotes = app.ReviewNotes,
                                          
                                          // Generated Card Info
                                          GeneratedCardId = app.GeneratedCardId,
                                          GeneratedCardNumber = card != null ? card.CardNumber : null,
                                          GeneratedCardType = card != null ? (CardType?)card.CardType : null
                                      }).ToListAsync();

            return applications;
        }

        [AbpAuthorize(Authorization.PermissionNames.Pages_Users, Authorization.PermissionNames.Admin)] 
        public async Task<List<CardApplicationDto>> GetCardApplications()
        {
            try
            {
                using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
                {
                    var applications = await (from app in _applicationRepository.GetAll()
                                              join card in _cardRepository.GetAll() on app.GeneratedCardId equals card.Id into cardJoin
                                              from card in cardJoin.DefaultIfEmpty()
                                              join user in UserManager.Users.IgnoreQueryFilters() on app.UserId equals user.Id
                                              orderby app.CreationTime descending
                                              select new CardApplicationDto
                                              {
                                                  Id = app.Id,
                                                  FullName = app.FullName,
                                                  ContactNumber = app.ContactNumber,
                                                  Address = app.Address,
                                                  CardType = app.CardType,
                                                  DocumentBase64 = null, // Optimized: Excluded from SQL query
                                                  DocumentType = app.DocumentType,
                                                  Status = app.Status.ToString(),
                                                  AppliedDate = app.AppliedDate,
                                                  ReviewedDate = app.ReviewedDate,
                                                  ReviewNotes = app.ReviewNotes,
                                                  UserName = user.UserName ?? "Unknown",
                                                  
                                                  // Generated Card Info
                                                  GeneratedCardId = app.GeneratedCardId,
                                                  GeneratedCardNumber = card != null ? card.CardNumber : null,
                                                  GeneratedCardType = card != null ? (CardType?)card.CardType : null
                                              }).ToListAsync();

                    return applications;
                }
            }
            catch (Exception ex)
            {
                throw new UserFriendlyException($"Error: {ex.Message}");
            }
        }

        [AbpAuthorize(Authorization.PermissionNames.Pages_Users, Authorization.PermissionNames.Admin)]
        public async Task<List<CardApplicationDto>> GetPendingApplications()
        {
            try
            {
                var applications = await _applicationRepository.GetAll()
                    .Where(a => a.Status == CardApplicationStatus.Pending)
                    .Select(a => new CardApplicationDto
                    {
                        Id = a.Id,
                        FullName = a.FullName,
                        ContactNumber = a.ContactNumber,
                        Address = a.Address,
                        CardType = a.CardType,
                        DocumentBase64 = null, // Optimized: Excluded from SQL query
                        DocumentType = a.DocumentType,
                        Status = a.Status.ToString(),
                        AppliedDate = a.AppliedDate
                    })
                    .ToListAsync();

                return applications;
            }
            catch (Exception ex)
            {
                throw new UserFriendlyException($"Error: {ex.Message}");
            }
        }

        [AbpAuthorize(Authorization.PermissionNames.Pages_Users, Authorization.PermissionNames.Admin)]
        public async Task<string> GetApplicationDocument(Guid id)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var application = await _applicationRepository.FirstOrDefaultAsync(id);
                if (application == null) throw new UserFriendlyException("Application not found");
                return application.DocumentBase64;
            }
        }

        [AbpAuthorize(Authorization.PermissionNames.Pages_Users, Authorization.PermissionNames.Admin)]
        public async Task<VirtualCardDto> ApproveCardApplication([Microsoft.AspNetCore.Mvc.FromBody] ApproveApplicationInput input)
        {
            try
            {
                using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
                {
                    if (input.Id == Guid.Empty)
                        throw new UserFriendlyException("Application ID is required");

                    var application = await _applicationRepository.GetAsync(input.Id);

                    if (application.Status != CardApplicationStatus.Pending)
                        throw new UserFriendlyException("Application is not pending");

                    application.Status = CardApplicationStatus.Approved;
                    application.ReviewedDate = DateTime.UtcNow;
                    application.ReviewedBy = AbpSession.GetUserId();
                    application.ReviewNotes = input.AdminRemarks;

                    // Ensure only one active card per user
                    var activeCards = await _cardRepository.GetAll()
                        .Where(c => c.UserId == application.UserId && c.Status == "Active")
                        .ToListAsync();
                    
                    foreach (var activeCard in activeCards)
                    {
                        activeCard.Status = "Inactive";
                        await _cardRepository.UpdateAsync(activeCard);
                    }

                    // Delete the previously active card (if any)
                    if (application.PreviousCardId.HasValue)
                    {
                        var previousCard = await _cardRepository.FirstOrDefaultAsync(application.PreviousCardId.Value);
                        if (previousCard != null)
                        {
                            await _cardRepository.DeleteAsync(previousCard);
                        }
                    }

                    // Cross-tenant user lookup
                    var user = await UserManager.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == application.UserId);
                    if (user == null) throw new UserFriendlyException("User not found for this application.");
                    
                    var card = new VirtualCard
                    {
                        UserId = user.Id,
                        TenantId = application.TenantId,
                        CardNumber = GenerateCardNumber(application.CardType),
                        CardType = application.CardType,
                        HolderName = application.FullName.ToUpper(),
                        ExpiryDate = DateTime.Now.AddYears(3).ToString("MM/yy"),
                        Cvv = GenerateCVV(),
                        Balance = 0,
                        Currency = "USD",
                        Status = "Active"
                    };

                    var cardId = await _cardRepository.InsertAndGetIdAsync(card);
                    application.GeneratedCardId = cardId;

                    await _applicationRepository.UpdateAsync(application);
                    var activeSubscriptionCode = await GetActiveSubscriptionCodeAsync();
                    var pendingSubscriptionCode = await GetPendingSubscriptionCodeAsync();

                    return new VirtualCardDto
                    {
                        CardId = cardId,
                        CardNumber = FormatCardNumber(card.CardNumber),
                        CardType = card.CardType,
                        HolderName = card.HolderName,
                        ExpiryDate = card.ExpiryDate,
                        Cvv = card.Cvv,
                        Balance = card.Balance,
                        Currency = card.Currency,
                        Status = card.Status,
                        ActiveSubscriptionCode = activeSubscriptionCode,
                        ActiveSubscription = GetPlanDisplayName(activeSubscriptionCode),
                        PendingSubscriptionCode = pendingSubscriptionCode,
                        PendingSubscription = GetPlanDisplayName(pendingSubscriptionCode)
                    };
                }
            }
            catch (Exception ex)
            {
                throw new UserFriendlyException($"Approval Error: {ex.Message}");
            }
        }


        [AbpAuthorize(Authorization.PermissionNames.Pages_Users, Authorization.PermissionNames.Admin)]
        public async Task RejectCardApplication([Microsoft.AspNetCore.Mvc.FromBody] RejectApplicationInput input)
        {
            try
            {
                if (input.Id == Guid.Empty)
                    throw new UserFriendlyException("Application ID is required");

                var application = await _applicationRepository.GetAsync(input.Id);

                if (application.Status != CardApplicationStatus.Pending)
                    throw new UserFriendlyException("Application is not pending");

                if (string.IsNullOrWhiteSpace(input.AdminRemarks))
                    throw new UserFriendlyException("Rejection reason is required");

                application.Status = CardApplicationStatus.Rejected;
                application.ReviewedDate = DateTime.UtcNow;
                application.ReviewedBy = AbpSession.GetUserId();
                application.ReviewNotes = input.AdminRemarks;

                // Reactivate the previously active card (if any), ensuring only one active card
                var activeCards = await _cardRepository.GetAll()
                    .Where(c => c.UserId == application.UserId && c.Status == "Active")
                    .ToListAsync();
                foreach (var activeCard in activeCards)
                {
                    activeCard.Status = "Inactive";
                    await _cardRepository.UpdateAsync(activeCard);
                }

                if (application.PreviousCardId.HasValue)
                {
                    var previousCard = await _cardRepository.FirstOrDefaultAsync(application.PreviousCardId.Value);
                    if (previousCard != null)
                    {
                        previousCard.Status = "Active";
                        await _cardRepository.UpdateAsync(previousCard);
                    }
                }

                await _applicationRepository.UpdateAsync(application);
            }
            catch (Exception ex)
            {
                throw new UserFriendlyException($"Error: {ex.Message} | Inner: {ex.InnerException?.Message}");
            }
        }


        private string GenerateCardNumber(CardType cardType)
        {
            var prefix = cardType == CardType.Visa ? "4" : cardType == CardType.MasterCard ? "5" : "3";
            var random = new Random();
            var digits = string.Join("", Enumerable.Range(0, 15).Select(_ => random.Next(0, 10)));
            return prefix + digits;
        }

        private string GenerateCVV()
        {
            var random = new Random();
            return random.Next(100, 999).ToString();
        }

        private string FormatCardNumber(string cardNumber)
        {
            if (cardNumber.Length != 16) return cardNumber;
            return $"{cardNumber.Substring(0, 4)} {cardNumber.Substring(4, 4)} {cardNumber.Substring(8, 4)} {cardNumber.Substring(12, 4)}";
        }

        private string MaskCardNumber(string formattedCardNumber)
        {
            var parts = formattedCardNumber.Split(' ');
            if (parts.Length != 4) return formattedCardNumber;
            return $"{parts[0]} **** **** {parts[3]}";
        }

        private static string BuildCardPaymentDescription(string sourcePlatform)
        {
            var platformLabel = NormalizePlatformLabel(sourcePlatform);
            return string.IsNullOrWhiteSpace(platformLabel)
                ? "Easy Finora Card Payment"
                : $"{platformLabel} product purchase via Easy Finora Card";
        }

        private static string NormalizePlatformLabel(string sourcePlatform)
        {
            if (string.IsNullOrWhiteSpace(sourcePlatform))
            {
                return null;
            }

            var normalized = sourcePlatform.Trim();
            if (normalized.Equals("PrimeShip", StringComparison.OrdinalIgnoreCase)) return "PrimeShip";
            if (normalized.Equals("SmartStore", StringComparison.OrdinalIgnoreCase)) return "World Cart";
            if (normalized.Equals("WorldCart", StringComparison.OrdinalIgnoreCase)) return "World Cart";

            return normalized;
        }

        private static (string PlanCode, string PlanName, decimal Amount) ResolveUpgradePlan(string planCode)
        {
            var normalized = NormalizePlanCode(planCode);
            return normalized switch
            {
                "free" => ("free", "Free", 0m),
                "standard" => ("standard", "Standard", 10m),
                "premium" => ("premium", "Premium", 25m),
                "business-plus" => ("business-plus", "Business Plus", 50m),
                _ => throw new UserFriendlyException("Invalid plan selected.")
            };
        }

        private static string NormalizePlanCode(string planCode)
        {
            var normalized = (planCode ?? string.Empty).Trim().ToLowerInvariant();
            if (normalized == "businessplus")
            {
                return "business-plus";
            }

            return normalized;
        }

        private static string GetPlanDisplayName(string planCode)
        {
            var normalized = NormalizePlanCode(planCode);
            return normalized switch
            {
                "free" => "Free",
                "standard" => "Standard",
                "premium" => "Premium",
                "business-plus" => "Business Plus",
                _ => string.Empty
            };
        }

        private static string NormalizeExpiry(string expiry)
        {
            if (string.IsNullOrWhiteSpace(expiry))
            {
                return string.Empty;
            }

            var value = expiry.Trim().Replace("-", "/");
            var parts = value.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
            {
                return value;
            }

            if (!int.TryParse(parts[0], out var month))
            {
                return value;
            }

            var yearPart = parts[1].Trim();
            if (yearPart.Length > 2)
            {
                yearPart = yearPart.Substring(yearPart.Length - 2);
            }

            return $"{month:00}/{yearPart.PadLeft(2, '0')}";
        }

        private static string NormalizeCardNumber(string cardNumber)
        {
            return NormalizeDigits(cardNumber);
        }

        private static string NormalizeDigits(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
            {
                return string.Empty;
            }

            return new string(input.Where(char.IsDigit).ToArray());
        }

        private static string NormalizeHolder(string holder)
        {
            if (string.IsNullOrWhiteSpace(holder))
            {
                return string.Empty;
            }

            var parts = holder
                .Trim()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries);

            return string.Join(" ", parts);
        }

        private async Task<string> GetActiveSubscriptionCodeAsync()
        {
            var value = await SettingManager.GetSettingValueForUserAsync(
                AppSettingNames.EasyFinoraActiveSubscriptionCode,
                AbpSession.ToUserIdentifier());

            var normalized = NormalizePlanCode(value);
            return string.IsNullOrWhiteSpace(normalized) ? "free" : normalized;
        }

        private async Task<string> GetPendingSubscriptionCodeAsync()
        {
            var value = await SettingManager.GetSettingValueForUserAsync(
                AppSettingNames.EasyFinoraPendingSubscriptionCode,
                AbpSession.ToUserIdentifier());

            return NormalizePlanCode(value);
        }

        private async Task SetActiveSubscriptionCodeAsync(string planCode)
        {
            var normalized = NormalizePlanCode(planCode);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                normalized = "free";
            }

            await SettingManager.ChangeSettingForUserAsync(
                AbpSession.ToUserIdentifier(),
                AppSettingNames.EasyFinoraActiveSubscriptionCode,
                normalized);
        }

        private async Task SetPendingSubscriptionCodeAsync(string planCode)
        {
            await SettingManager.ChangeSettingForUserAsync(
                AbpSession.ToUserIdentifier(),
                AppSettingNames.EasyFinoraPendingSubscriptionCode,
                NormalizePlanCode(planCode));
        }

        private async Task<string> GetActiveSubscriptionCodeAsync(int tenantId, long userId)
        {
            var value = await SettingManager.GetSettingValueForUserAsync(
                AppSettingNames.EasyFinoraActiveSubscriptionCode,
                new Abp.UserIdentifier(tenantId, userId));

            var normalized = NormalizePlanCode(value);
            return string.IsNullOrWhiteSpace(normalized) ? "free" : normalized;
        }

        private static SubscriptionLimit GetSubscriptionLimit(string planCode)
        {
            return NormalizePlanCode(planCode) switch
            {
                "standard" => new SubscriptionLimit("Standard", 300m, 2500m, 5, 50),
                "premium" => new SubscriptionLimit("Premium", 500m, 5000m, 10, 100),
                "business-plus" => new SubscriptionLimit("Business Plus", 2000m, 50000m, 20, 500),
                _ => new SubscriptionLimit("Free", 150m, 1500m, 3, 15)
            };
        }

        private async Task<string> ValidateCardTransactionLimitsAsync(VirtualCard card, decimal amount)
        {
            if (amount <= 0m)
            {
                return null;
            }

            var activePlanCode = await GetActiveSubscriptionCodeAsync(card.TenantId, card.UserId);
            var limits = GetSubscriptionLimit(activePlanCode);
            var nowUtc = DateTime.UtcNow;
            var dayStartUtc = nowUtc.Date;
            var monthStartUtc = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var txQuery = _transactionRepository.GetAll()
                .IgnoreQueryFilters()
                .Where(t =>
                    t.TenantId == card.TenantId &&
                    t.UserId == card.UserId &&
                    t.CardId == card.Id &&
                    t.MovementType == "Debit" &&
                    t.Category == "Card Transaction" &&
                    t.Status == "Approved");

            var dailyCount = await txQuery
                .Where(t => t.CreationTime >= dayStartUtc)
                .CountAsync();

            if (dailyCount + 1 > limits.TransactionsPerDay)
            {
                return $"Daily transaction count limit reached for {limits.PlanName} plan ({limits.TransactionsPerDay}/day).";
            }

            var monthlyCount = await txQuery
                .Where(t => t.CreationTime >= monthStartUtc)
                .CountAsync();

            if (monthlyCount + 1 > limits.TransactionsPerMonth)
            {
                return $"Monthly transaction count limit reached for {limits.PlanName} plan ({limits.TransactionsPerMonth}/month). Please try again next month.";
            }

            var dailyAmountUsed = Math.Abs((await txQuery
                .Where(t => t.CreationTime >= dayStartUtc)
                .SumAsync(t => (decimal?)t.Amount)) ?? 0m);

            if (dailyAmountUsed + amount > limits.DailyAmountLimit)
            {
                return $"Daily amount limit exceeded for {limits.PlanName} plan (${limits.DailyAmountLimit}).";
            }

            var monthlyAmountUsed = Math.Abs((await txQuery
                .Where(t => t.CreationTime >= monthStartUtc)
                .SumAsync(t => (decimal?)t.Amount)) ?? 0m);

            if (monthlyAmountUsed + amount > limits.MonthlyAmountLimit)
            {
                return $"Monthly amount limit exceeded for {limits.PlanName} plan (${limits.MonthlyAmountLimit}). Please try again next month.";
            }

            return null;
        }

        private async Task<decimal> GetWalletBalanceAsync(VirtualCard card)
        {
            // Ensure we check the wallet in the same tenant as the card
            using (UnitOfWorkManager.Current.SetTenantId(card.TenantId))
            {
                if (card.TenantId == 1) // Assuming 1 is SmartStore
                {
                    return await _smartStoreWalletManager.GetBalanceAsync(card.UserId);
                }

                return await _walletManager.GetBalanceAsync(card.UserId);
            }
        }

        private async Task<bool> TryDebitWalletAsync(VirtualCard card, decimal amount, string referenceId, string description)
        {
            // Ensure we debit the wallet in the same tenant as the card
            using (UnitOfWorkManager.Current.SetTenantId(card.TenantId))
            {
                if (card.TenantId == 1) // Assuming 1 is SmartStore
                {
                    return await _smartStoreWalletManager.TryDebitAsync(card.UserId, amount, referenceId, description);
                }

                return await _walletManager.TryDebitAsync(card.UserId, amount, referenceId, description);
            }
        }

        [AbpAllowAnonymous]
        public async Task RefundPayment(long userId, decimal amount, string referenceId, string description)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                // Deposit back to Wallet
                await _walletManager.DepositAsync(userId, amount, referenceId, description);

                // Record transaction for card history (as a Credit/Refund)
                await _transactionRepository.InsertAsync(new AppTransaction
                {
                    UserId = userId,
                    Amount = amount,
                    MovementType = "Credit",
                    Category = "Card Refund",
                    ReferenceId = referenceId,
                    Description = description,
                    Status = "Approved"
                });
            }
        }

        private sealed class SubscriptionLimit
        {
            public SubscriptionLimit(string planName, decimal dailyAmountLimit, decimal monthlyAmountLimit, int transactionsPerDay, int transactionsPerMonth)
            {
                PlanName = planName;
                DailyAmountLimit = dailyAmountLimit;
                MonthlyAmountLimit = monthlyAmountLimit;
                TransactionsPerDay = transactionsPerDay;
                TransactionsPerMonth = transactionsPerMonth;
            }

            public string PlanName { get; }
            public decimal DailyAmountLimit { get; }
            public decimal MonthlyAmountLimit { get; }
            public int TransactionsPerDay { get; }
            public int TransactionsPerMonth { get; }
        }
    }
}
