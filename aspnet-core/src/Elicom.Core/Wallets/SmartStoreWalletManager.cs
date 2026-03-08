using Abp.Domain.Repositories;
using Abp.Domain.Services;
using Abp.UI;
using Elicom.Entities;
using System;
using System.Threading.Tasks;

namespace Elicom.Wallets
{
    public class SmartStoreWalletManager : DomainService, ISmartStoreWalletManager
    {
        private readonly IRepository<SmartStoreWallet, Guid> _walletRepository;
        private readonly IRepository<SmartStoreWalletTransaction, Guid> _transactionRepository;

        public SmartStoreWalletManager(
            IRepository<SmartStoreWallet, Guid> walletRepository,
            IRepository<SmartStoreWalletTransaction, Guid> transactionRepository)
        {
            _walletRepository = walletRepository;
            _transactionRepository = transactionRepository;
        }

        public async Task<decimal> GetBalanceAsync(long userId)
        {
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == userId);
            return wallet?.Balance ?? 0;
        }

        public async Task CreditAsync(long userId, decimal amount, string referenceId, string description, string movementType = "Sale", string status = "Completed")
        {
            if (amount <= 0) throw new UserFriendlyException("Amount must be positive");

            var wallet = await GetOrCreateWalletAsync(userId);
            wallet.Balance += amount;
            
            await _transactionRepository.InsertAsync(new SmartStoreWalletTransaction
            {
                WalletId = wallet.Id,
                Amount = amount,
                MovementType = movementType,
                ReferenceId = referenceId,
                Description = description,
                Status = status
            });
        }

        public async Task<bool> TryDebitAsync(long userId, decimal amount, string referenceId, string description)
        {
             if (amount <= 0) throw new UserFriendlyException("Amount must be positive");

            var wallet = await GetOrCreateWalletAsync(userId);
            if (wallet.Balance < amount) return false;

            wallet.Balance -= amount;

            await _transactionRepository.InsertAsync(new SmartStoreWalletTransaction
            {
                WalletId = wallet.Id,
                Amount = -amount,
                MovementType = "Payout",
                ReferenceId = referenceId,
                Description = description,
                Status = "Completed"
            });

            return true;
        }

        public async Task<bool> TryHoldAsync(long userId, decimal amount, string referenceId, string description)
        {
            if (amount <= 0) throw new UserFriendlyException("Amount must be positive");

            var wallet = await GetOrCreateWalletAsync(userId);
            if (wallet.Balance < amount) return false;

            wallet.Balance -= amount;

            await _transactionRepository.InsertAsync(new SmartStoreWalletTransaction
            {
                WalletId = wallet.Id,
                Amount = -amount,
                MovementType = "Payout",
                ReferenceId = referenceId,
                Description = description,
                Status = "Pending"
            });

            return true;
        }

        public async Task UpdateTransactionStatusAsync(long userId, string referenceId, string status)
        {
            var wallet = await GetOrCreateWalletAsync(userId);
            var tx = await _transactionRepository.FirstOrDefaultAsync(t =>
                t.WalletId == wallet.Id && t.ReferenceId == referenceId);

            if (tx == null) return;

            tx.Status = status;
        }

        private async Task<SmartStoreWallet> GetOrCreateWalletAsync(long userId)
        {
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == userId);
            if (wallet == null)
            {
                wallet = new SmartStoreWallet 
                { 
                    Id = Guid.NewGuid(),
                    UserId = userId, 
                    Balance = 0, 
                    Currency = "USD" 
                };
                await _walletRepository.InsertAsync(wallet);
            }
            return wallet;
        }
    }
}
