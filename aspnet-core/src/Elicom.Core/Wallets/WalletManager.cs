using Abp.Domain.Repositories;
using Abp.Domain.Services;
using Abp.UI;
using Elicom.Entities;
using System;
using System.Threading.Tasks;

namespace Elicom.Wallets
{
    public class WalletManager : DomainService, IWalletManager
    {
        private readonly IRepository<Wallet, Guid> _walletRepository;
        private readonly IRepository<WalletTransaction, Guid> _transactionRepository;

        public WalletManager(
            IRepository<Wallet, Guid> walletRepository,
            IRepository<WalletTransaction, Guid> transactionRepository)
        {
            _walletRepository = walletRepository;
            _transactionRepository = transactionRepository;
        }

        public async Task<decimal> GetBalanceAsync(long userId)
        {
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == userId);
            return wallet?.Balance ?? 0;
        }

        public async Task DepositAsync(long userId, decimal amount, string referenceId, string description)
        {
            if (amount <= 0) throw new UserFriendlyException("Amount must be positive");

            var wallet = await GetOrCreateWalletAsync(userId);
            wallet.Balance += amount;
            
            await _transactionRepository.InsertAsync(new WalletTransaction
            {
                WalletId = wallet.Id,
                Amount = amount, 
                MovementType = "Deposit",
                ReferenceId = referenceId,
                Description = description
            });
        }

        public async Task<bool> TryDebitAsync(long userId, decimal amount, string referenceId, string description)
        {
             if (amount <= 0) throw new UserFriendlyException("Amount must be positive");

            var wallet = await GetOrCreateWalletAsync(userId);
            if (wallet.Balance < amount) return false;

            wallet.Balance -= amount;

            await _transactionRepository.InsertAsync(new WalletTransaction
            {
                WalletId = wallet.Id,
                Amount = -amount,
                MovementType = "Debit",
                ReferenceId = referenceId,
                Description = description
            });

            return true;
        }

        public async Task TransferAsync(long senderUserId, long receiverUserId, decimal amount, string description)
        {
            if (amount <= 0) throw new UserFriendlyException("Amount must be positive");
            if (senderUserId == receiverUserId) throw new UserFriendlyException("Cannot transfer to yourself");

            var senderWallet = await GetOrCreateWalletAsync(senderUserId);
            var receiverWallet = await GetOrCreateWalletAsync(receiverUserId);

            if (senderWallet.Balance < amount)
            {
                throw new UserFriendlyException("Insufficient balance in your wallet.");
            }

            var refId = $"TRF-{DateTime.Now.Ticks}";

            // 1. Debit sender
            senderWallet.Balance -= amount;
            await _transactionRepository.InsertAsync(new WalletTransaction
            {
                WalletId = senderWallet.Id,
                Amount = -amount,
                MovementType = "Transfer Out",
                ReferenceId = refId,
                Description = description
            });

            // 2. Credit receiver
            receiverWallet.Balance += amount;
            await _transactionRepository.InsertAsync(new WalletTransaction
            {
                WalletId = receiverWallet.Id,
                Amount = amount,
                MovementType = "Transfer In",
                ReferenceId = refId,
                Description = $"From User {senderUserId}: {description}"
            });
        }

        private async Task<Wallet> GetOrCreateWalletAsync(long userId)
        {
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == userId);
            if (wallet == null)
            {
                wallet = new Wallet 
                { 
                    Id = Guid.NewGuid(), // Generate ID manually
                    UserId = userId, 
                    Balance = 0, 
                    Currency = "PKR" 
                };
                await _walletRepository.InsertAsync(wallet);
                // No need to SaveChanges here; EF tracks the new entity
            }
            return wallet;
        }
    }
}
