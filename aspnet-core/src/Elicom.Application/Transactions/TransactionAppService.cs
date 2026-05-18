using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Runtime.Session;
using Elicom.Entities;
using Elicom.Transactions.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Transactions
{
    [AbpAuthorize]
    public class TransactionAppService : ElicomAppServiceBase, ITransactionAppService
    {
        private readonly IRepository<WalletTransaction, Guid> _walletTransactionRepository;
        private readonly IRepository<Wallet, Guid> _walletRepository;
        private readonly IRepository<AppTransaction, long> _appTransactionRepository;

        public TransactionAppService(
            IRepository<WalletTransaction, Guid> walletTransactionRepository,
            IRepository<Wallet, Guid> walletRepository,
            IRepository<AppTransaction, long> appTransactionRepository)
        {
            _walletTransactionRepository = walletTransactionRepository;
            _walletRepository = walletRepository;
            _appTransactionRepository = appTransactionRepository;
        }

        public async Task<PagedResultDto<TransactionDto>> GetHistory(PagedAndSortedResultRequestDto input)
        {
            var userId = AbpSession.GetUserId();
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == userId);

            // Fetch Wallet Transactions
            var walletQuery = _walletTransactionRepository.GetAll().Where(t => t.WalletId == (wallet != null ? wallet.Id : Guid.Empty));
            var walletItems = await walletQuery.ToListAsync();
            var walletDtos = walletItems.Select(t => MapToDto(t)).ToList();

            // Fetch Card Transactions
            var cardQuery = _appTransactionRepository.GetAll()
                .Where(t => t.UserId == userId && t.Status == "Approved");
            var cardItems = await cardQuery.ToListAsync();
            var cardDtos = cardItems.Select(t => MapToDto(t)).ToList();

            // App/card entries duplicate some wallet-backed operations (card purchases, payouts, refunds).
            // Prefer the app transaction row so the user sees a single stable history item.
            var allTransactions = BuildDedupedHistory(walletDtos, cardDtos);

            var totalCount = allTransactions.Count;
            var pagedTransactions = allTransactions
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount)
                .ToList();

            return new PagedResultDto<TransactionDto>(totalCount, pagedTransactions);
        }

        private static List<TransactionDto> BuildDedupedHistory(
            IEnumerable<TransactionDto> walletTransactions,
            IEnumerable<TransactionDto> appTransactions)
        {
            return walletTransactions
                .Select(t => new TransactionHistoryCandidate
                {
                    SourcePriority = 1,
                    DedupeKey = BuildDedupeKey(t),
                    Transaction = t
                })
                .Concat(appTransactions.Select(t => new TransactionHistoryCandidate
                {
                    SourcePriority = 2,
                    DedupeKey = BuildDedupeKey(t),
                    Transaction = t
                }))
                .GroupBy(x => x.DedupeKey ?? $"source:{x.SourcePriority}|id:{x.Transaction.Id}")
                .Select(g => g
                    .OrderByDescending(x => x.SourcePriority)
                    .ThenByDescending(x => x.Transaction.CreationTime)
                    .First()
                    .Transaction)
                .OrderByDescending(t => t.CreationTime)
                .ToList();
        }

        private static string BuildDedupeKey(TransactionDto transaction)
        {
            var referenceId = (transaction?.ReferenceId ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(referenceId))
            {
                return null;
            }

            var movementType = (transaction?.MovementType ?? string.Empty).Trim().ToUpperInvariant();
            var amount = Math.Abs(transaction?.Amount ?? 0m)
                .ToString("0.00####", CultureInfo.InvariantCulture);

            return $"{referenceId.ToUpperInvariant()}|{movementType}|{amount}";
        }

        [AbpAuthorize(Authorization.PermissionNames.Pages_GlobalPay_Admin)]
        public async Task<PagedResultDto<TransactionDto>> GetAll(PagedAndSortedResultRequestDto input)
        {
            var walletQuery = _walletTransactionRepository.GetAll();
            var walletItems = await walletQuery.ToListAsync();
            var walletDtos = walletItems.Select(t => MapToDto(t)).ToList();

            var cardQuery = _appTransactionRepository.GetAll();
            var cardItems = await cardQuery.ToListAsync();
            var cardDtos = cardItems.Select(t => MapToDto(t)).ToList();

            var allTransactions = walletDtos.Concat(cardDtos)
                .OrderByDescending(t => t.CreationTime)
                .ToList();

            var totalCount = allTransactions.Count;
            var pagedTransactions = allTransactions
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount)
                .ToList();

            return new PagedResultDto<TransactionDto>(totalCount, pagedTransactions);
        }

        private TransactionDto MapToDto(WalletTransaction t)
        {
            string category = "Unknown";
            string type = t.MovementType ?? string.Empty;
            string description = t.Description ?? string.Empty;

            if (type == "Deposit") category = "Deposit";
            else if (type == "Debit")
            {
                var isWithdrawal =
                    description.Contains("withdraw", StringComparison.OrdinalIgnoreCase) ||
                    description.Contains("payout", StringComparison.OrdinalIgnoreCase);

                if (isWithdrawal) category = "Withdrawal";
                else category = "Card";
            }
            else if (type.Contains("Transfer")) category = "Transfer";

            return new TransactionDto
            {
                Id = t.Id.ToString(),
                CardId = null,
                Amount = Math.Abs(t.Amount),
                MovementType = t.Amount < 0 ? "Debit" : "Credit",
                Category = category,
                ReferenceId = t.ReferenceId,
                Description = t.Description,
                CreationTime = t.CreationTime
            };
        }

        private TransactionDto MapToDto(AppTransaction t)
        {
            var category = NormalizeCategory(t.Category, t.Description, t.MovementType, t.CardId);
            return new TransactionDto
            {
                Id = t.Id.ToString(),
                CardId = t.CardId,
                Amount = Math.Abs(t.Amount),
                MovementType = t.MovementType,
                Category = category,
                ReferenceId = t.ReferenceId,
                Description = t.Description,
                CreationTime = t.CreationTime
            };
        }

        private static string NormalizeCategory(string category, string description, string movementType, long? cardId)
        {
            var categoryText = (category ?? string.Empty).Trim();
            var descriptionText = (description ?? string.Empty).Trim();
            var movementText = (movementType ?? string.Empty).Trim();

            if (categoryText.Contains("deposit", StringComparison.OrdinalIgnoreCase)) return "Deposit";
            if (categoryText.Contains("withdraw", StringComparison.OrdinalIgnoreCase)) return "Withdrawal";
            if (categoryText.Contains("transfer", StringComparison.OrdinalIgnoreCase)) return "Transfer";
            if (categoryText.Contains("card", StringComparison.OrdinalIgnoreCase)) return "Card";

            if (cardId.HasValue && cardId.Value > 0) return "Card";
            if (movementText.Contains("transfer", StringComparison.OrdinalIgnoreCase)) return "Transfer";
            if (movementText.Equals("Debit", StringComparison.OrdinalIgnoreCase)
                && descriptionText.Contains("withdraw", StringComparison.OrdinalIgnoreCase)) return "Withdrawal";
            if (movementText.Equals("Credit", StringComparison.OrdinalIgnoreCase)
                && descriptionText.Contains("deposit", StringComparison.OrdinalIgnoreCase)) return "Deposit";

            return string.IsNullOrWhiteSpace(categoryText) ? "Card" : categoryText;
        }

        private sealed class TransactionHistoryCandidate
        {
            public int SourcePriority { get; set; }

            public string DedupeKey { get; set; }

            public TransactionDto Transaction { get; set; }
        }
    }
}
