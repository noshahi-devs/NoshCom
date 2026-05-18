using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Runtime.Session;
using Abp.UI;
using Elicom.Authorization;
using Elicom.Cards;
using Elicom.Entities;
using Elicom.Withdrawals.Dto;
using Elicom.Wallets;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Withdrawals
{
    [AbpAuthorize]
    public class WithdrawAppService : ElicomAppServiceBase, IWithdrawAppService
    {
        private readonly IRepository<WithdrawRequest, long> _withdrawRepository;
        private readonly IRepository<VirtualCard, long> _cardRepository;
        private readonly IRepository<AppTransaction, long> _transactionRepository;
        private readonly IWalletManager _walletManager;
        private readonly ISmartStoreWalletManager _smartStoreWalletManager;
        private readonly IRepository<Elicom.Entities.SupplierOrder, Guid> _supplierOrderRepository;

        public WithdrawAppService(
            IRepository<WithdrawRequest, long> withdrawRepository,
            IRepository<VirtualCard, long> cardRepository,
            IWalletManager walletManager,
            IRepository<AppTransaction, long> transactionRepository,
            ISmartStoreWalletManager smartStoreWalletManager,
            IRepository<Elicom.Entities.SupplierOrder, Guid> supplierOrderRepository)
        {
            _withdrawRepository = withdrawRepository;
            _cardRepository = cardRepository;
            _walletManager = walletManager;
            _transactionRepository = transactionRepository;
            _smartStoreWalletManager = smartStoreWalletManager;
            _supplierOrderRepository = supplierOrderRepository;
        }

        public async Task<WithdrawalEligibilityDto> GetWithdrawalEligibility()
        {
            var userId = AbpSession.GetUserId();
            var result = new WithdrawalEligibilityDto { IsEligible = true };

            // 1. Get first successful order (Verified at Hub)
            var firstOrder = await _supplierOrderRepository.GetAll()
                .Where(o => o.SupplierId == userId && o.Status == "Verified")
                .OrderBy(o => o.CreationTime)
                .FirstOrDefaultAsync();

            if (firstOrder == null)
            {
                result.IsEligible = false;
                result.Message = "You haven't had any verified orders yet.";
                return result;
            }

            // 2. Get withdrawal count and last withdrawal date
            var withdrawals = await _withdrawRepository.GetAll()
                .Where(w => w.UserId == userId && w.Status == "Approved")
                .OrderByDescending(w => w.CreationTime)
                .ToListAsync();

            DateTime nextEligibleDate;
            int totalWithdrawals = withdrawals.Count;

            if (totalWithdrawals == 0)
            {
                // Rule 1: 10 days after first order
                nextEligibleDate = firstOrder.CreationTime.AddDays(10);
            }
            else if (totalWithdrawals == 1)
            {
                // Rule 2: 7 days after first withdrawal
                nextEligibleDate = withdrawals[0].CreationTime.AddDays(7);
            }
            else
            {
                // Rule 3: 5 days after last withdrawal
                nextEligibleDate = withdrawals[0].CreationTime.AddDays(5);
            }

            if (DateTime.Now < nextEligibleDate)
            {
                var diff = nextEligibleDate - DateTime.Now;
                result.IsEligible = false;
                result.DaysRemaining = diff.Days;
                result.HoursRemaining = diff.Hours;
                result.MinutesRemaining = diff.Minutes;
                result.NextEligibleDate = nextEligibleDate.ToString("yyyy-MM-dd HH:mm");
                result.Message = $"Your next withdrawal will be available in {result.DaysRemaining}d {result.HoursRemaining}h.";
            }
            else
            {
                result.Message = "You are eligible for a withdrawal.";
            }

            return result;
        }

        public async Task<WithdrawRequestDto> SubmitWithdrawRequest(CreateWithdrawRequestInput input)
        {
            var userId = AbpSession.GetUserId();

            // 1. Verify card destination belongs to the current user and check wallet balance
            var card = await _cardRepository.GetAsync(input.CardId);
            if (card.UserId != userId)
            {
                throw new UserFriendlyException("Selected card must belong to you.");
            }

            var walletBalance = await _walletManager.GetBalanceAsync(userId);
            if (walletBalance < input.Amount)
            {
                throw new UserFriendlyException($"Insufficient wallet balance. Available: ${walletBalance:F2}, Requested: ${input.Amount:F2}");
            }

            // 2. Create withdrawal request
            var serviceFee = Math.Round(input.Amount * 0.03m, 2);
            var netAmount = input.Amount - serviceFee;

            var request = new WithdrawRequest
            {
                TenantId = AbpSession.GetTenantId(),
                UserId = userId,
                CardId = input.CardId,
                Amount = input.Amount,
                ServiceFee = serviceFee,
                NetAmount = netAmount,
                Currency = "USD",
                Method = input.Method ?? "Bank Transfer",
                PaymentDetails = input.PaymentDetails ?? $"Card Ending {card.CardNumber.Substring(card.CardNumber.Length - 4)}",
                LocalAmount = input.LocalAmount,
                LocalCurrency = input.LocalCurrency,
                Status = "Pending"
            };

            var id = await _withdrawRepository.InsertAndGetIdAsync(request);

            // 3. Immediately reserve the amount from wallet and card while request is pending.
            var debited = await _walletManager.TryDebitAsync(
                userId,
                input.Amount,
                id.ToString(),
                $"Withdrawal #{id} pending approval"
            );

            if (!debited)
            {
                throw new UserFriendlyException("Insufficient wallet balance for this withdrawal.");
            }

            card.Balance -= input.Amount;
            await _cardRepository.UpdateAsync(card);

            await _transactionRepository.InsertAsync(new AppTransaction
            {
                TenantId = request.TenantId,
                UserId = userId,
                CardId = input.CardId,
                Amount = -input.Amount,
                MovementType = "Debit",
                Category = "Withdrawal",
                ReferenceId = id.ToString(),
                Status = "Pending",
                Description = $"Withdrawal request of ${input.Amount} submitted and reserved from Card {input.CardId}"
            });

            await CurrentUnitOfWork.SaveChangesAsync();
            
            return new WithdrawRequestDto
            {
                Id = id,
                UserId = userId,
                CardId = input.CardId,
                Amount = input.Amount,
                ServiceFee = serviceFee,
                NetAmount = netAmount,
                Method = request.Method,
                PaymentDetails = request.PaymentDetails,
                Status = "Pending",
                CreationTime = request.CreationTime
            };
        }

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
                    ServiceFee = r.ServiceFee,
                    NetAmount = r.NetAmount,
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

        [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin)]
        public async Task ApproveWithdraw(ApproveWithdrawRequestInput input)
        {
            var request = await _withdrawRepository.GetAsync(input.Id);
            if (request.Status != "Pending")
            {
                throw new UserFriendlyException("Only pending requests can be approved.");
            }

            // Amount was already reserved/deducted when the request was submitted.
            request.Status = "Approved";
            request.AdminRemarks = input.AdminRemarks;
            request.PaymentProof = input.PaymentProof;
            await _withdrawRepository.UpdateAsync(request);

            var pendingTransactions = await _transactionRepository.GetAll()
                .Where(t => t.ReferenceId == request.Id.ToString()
                            && t.UserId == request.UserId
                            && t.Category == "Withdrawal"
                            && t.Status == "Pending")
                .ToListAsync();

            foreach (var transaction in pendingTransactions)
            {
                transaction.Status = "Approved";
                transaction.Description = $"Withdrawal of ${request.Amount} (Received: ${request.NetAmount}) from Card {request.CardId}";
            }

            await CurrentUnitOfWork.SaveChangesAsync();
        }

        [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin)]
        public async Task RejectWithdraw(ApproveWithdrawRequestInput input)
        {
            var request = await _withdrawRepository.GetAsync(input.Id);
            if (request.Status != "Pending")
            {
                throw new UserFriendlyException("Only pending requests can be rejected.");
            }

            var card = await _cardRepository.GetAsync(request.CardId);
            card.Balance += request.Amount;
            await _cardRepository.UpdateAsync(card);

            await _walletManager.DepositAsync(
                request.UserId,
                request.Amount,
                request.Id.ToString(),
                $"Withdrawal #{request.Id} rejected and refunded"
            );

            var pendingTransactions = await _transactionRepository.GetAll()
                .Where(t => t.ReferenceId == request.Id.ToString()
                            && t.UserId == request.UserId
                            && t.Category == "Withdrawal"
                            && t.Status == "Pending")
                .ToListAsync();

            foreach (var transaction in pendingTransactions)
            {
                transaction.Status = "Rejected";
                transaction.Description = $"Withdrawal #{request.Id} was rejected and refunded";
            }

            await _transactionRepository.InsertAsync(new AppTransaction
            {
                TenantId = request.TenantId,
                UserId = request.UserId,
                CardId = request.CardId,
                Amount = request.Amount,
                MovementType = "Credit",
                Category = "Withdrawal Refund",
                ReferenceId = request.Id.ToString(),
                Status = "Approved",
                Description = $"Refund for rejected withdrawal #{request.Id}"
            });

            request.Status = "Rejected";
            request.AdminRemarks = input.AdminRemarks;
            await _withdrawRepository.UpdateAsync(request);

            await CurrentUnitOfWork.SaveChangesAsync();
        }

        [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin)]
        public async Task<PagedResultDto<WithdrawRequestDto>> GetAllWithdrawRequests(PagedAndSortedResultRequestDto input)
        {
            var query = _withdrawRepository.GetAll().AsNoTracking();

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreationTime)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount)
                // Projection prevents loading large PaymentProof payloads for list view
                .Select(r => new WithdrawRequestDto
                {
                    Id = r.Id,
                    UserId = r.UserId,
                    UserName = r.User != null ? r.User.UserName : "Unknown",
                    CardId = r.CardId,
                    Amount = r.Amount,
                    ServiceFee = r.ServiceFee,
                    NetAmount = r.NetAmount,
                    Method = r.Method,
                    PaymentDetails = r.PaymentDetails,
                    Status = r.Status,
                    AdminRemarks = r.AdminRemarks,
                    LocalAmount = r.LocalAmount,
                    LocalCurrency = r.LocalCurrency,
                    HasProof = r.PaymentProof != null && r.PaymentProof != "",
                    PaymentProof = null,
                    CreationTime = r.CreationTime
                })
                .ToListAsync();

            return new PagedResultDto<WithdrawRequestDto>(totalCount, items);
        }

        [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin)]
        public async Task<string> GetPaymentProof(long id)
        {
            var request = await _withdrawRepository.GetAsync(id);
            return request.PaymentProof;
        }
    }
}
