using Abp.Domain.Repositories;
using Abp.Domain.Services;
using Abp.UI;
using Elicom.Entities;
using Elicom.Cards;
using System;
using System.Threading.Tasks;

namespace Elicom.Wallets
{
    public class WalletManager : DomainService, IWalletManager
    {
        private readonly IRepository<Wallet, Guid> _walletRepository;
        private readonly IRepository<WalletTransaction, Guid> _transactionRepository;
        private readonly IRepository<VirtualCard, long> _virtualCardRepository;

        public WalletManager(
            IRepository<Wallet, Guid> walletRepository,
            IRepository<WalletTransaction, Guid> transactionRepository,
            IRepository<VirtualCard, long> virtualCardRepository)
        {
            _walletRepository = walletRepository;
            _transactionRepository = transactionRepository;
            _virtualCardRepository = virtualCardRepository;
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
            await _walletRepository.UpdateAsync(wallet);
            
            await _transactionRepository.InsertAsync(new WalletTransaction
            {
                WalletId = wallet.Id,
                Amount = amount, 
                MovementType = "Deposit",
                ReferenceId = referenceId,
                Description = description
            });

            // Sync with Active Virtual Card
            var activeCard = await _virtualCardRepository.FirstOrDefaultAsync(c => c.UserId == userId && c.Status == "Active");
            if (activeCard != null)
            {
                activeCard.Balance += amount;
                await _virtualCardRepository.UpdateAsync(activeCard);
            }
        }

        public async Task<bool> TryDebitAsync(long userId, decimal amount, string referenceId, string description)
        {
             if (amount <= 0) throw new UserFriendlyException("Amount must be positive");

            var wallet = await GetOrCreateWalletAsync(userId);
            if (wallet.Balance < amount) return false;

            wallet.Balance -= amount;
            await _walletRepository.UpdateAsync(wallet);

            await _transactionRepository.InsertAsync(new WalletTransaction
            {
                WalletId = wallet.Id,
                Amount = -amount,
                MovementType = "Debit",
                ReferenceId = referenceId,
                Description = description
            });

            // Sync with Active Virtual Card
            var activeCard = await _virtualCardRepository.FirstOrDefaultAsync(c => c.UserId == userId && c.Status == "Active");
            if (activeCard != null)
            {
                activeCard.Balance -= amount;
                await _virtualCardRepository.UpdateAsync(activeCard);
            }

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
            await _walletRepository.UpdateAsync(senderWallet);
            await _transactionRepository.InsertAsync(new WalletTransaction
            {
                WalletId = senderWallet.Id,
                Amount = -amount,
                MovementType = "Transfer Out",
                ReferenceId = refId,
                Description = description
            });

            // Sync Sender's Active Virtual Card balance
            var senderActiveCard = await _virtualCardRepository.FirstOrDefaultAsync(c => c.UserId == senderUserId && c.Status == "Active");
            if (senderActiveCard != null)
            {
                senderActiveCard.Balance -= amount;
                await _virtualCardRepository.UpdateAsync(senderActiveCard);
            }

            // 2. Credit receiver
            receiverWallet.Balance += amount;
            await _walletRepository.UpdateAsync(receiverWallet);
            await _transactionRepository.InsertAsync(new WalletTransaction
            {
                WalletId = receiverWallet.Id,
                Amount = amount,
                MovementType = "Transfer In",
                ReferenceId = refId,
                Description = $"From User {senderUserId}: {description}"
            });

            // Sync receiver's Active Virtual Card balance
            var receiverActiveCard = await _virtualCardRepository.FirstOrDefaultAsync(c => c.UserId == receiverUserId && c.Status == "Active");
            if (receiverActiveCard != null)
            {
                receiverActiveCard.Balance += amount;
                await _virtualCardRepository.UpdateAsync(receiverActiveCard);
            }
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
