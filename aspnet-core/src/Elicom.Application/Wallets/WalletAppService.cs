using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Elicom.Authorization.Users;
using Elicom.Entities;
using Elicom.Wallets.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Wallets
{
    [AbpAuthorize]
    public class WalletAppService : ElicomAppServiceBase, IWalletAppService
    {
        private readonly IWalletManager _walletManager;
        private readonly IRepository<Wallet, Guid> _walletRepository;
        private readonly IRepository<WalletTransaction, Guid> _transactionRepository;

        public WalletAppService(
            IWalletManager walletManager,
            IRepository<Wallet, Guid> walletRepository,
            IRepository<WalletTransaction, Guid> transactionRepository)
        {
            _walletManager = walletManager;
            _walletRepository = walletRepository;
            _transactionRepository = transactionRepository;
        }

        [Abp.Domain.Uow.UnitOfWork(System.Transactions.TransactionScopeOption.Suppress)]
        public async Task<WalletDto> GetMyWallet()
        {
            var user = await GetCurrentUserAsync();
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == user.Id);
            
            // Auto-create if missing (failsafe)
            if (wallet == null)
            {
                wallet = new Wallet { UserId = user.Id, Balance = 0, Currency = "PKR" };
                await _walletRepository.InsertAsync(wallet);
                // await CurrentUnitOfWork.SaveChangesAsync(); // Removed for atomicity
            }

            var dto = ObjectMapper.Map<WalletDto>(wallet);
            dto.DisplayWalletId = user.WalletId;
            return dto;
        }

        public async Task Deposit(DepositInput input)
        {
            var user = await GetCurrentUserAsync();
            // In a real app, integrate with Payment Gateway here.
            // For now, assume payment success and credit wallet.
            
            await _walletManager.DepositAsync(
                user.Id, 
                input.Amount, 
                $"DEP-{DateTime.Now.Ticks}", 
                $"Deposit via {input.Method}"
            );
        }

        public async Task Transfer(TransferInput input)
        {
            var sender = await GetCurrentUserAsync();

            User receiver = null;

            if (!string.IsNullOrWhiteSpace(input.RecipientWalletId))
            {
                var recipientWalletId = input.RecipientWalletId.Trim();
                var recipientWalletIdUpper = recipientWalletId.ToUpper();

                receiver = await UserManager.Users.FirstOrDefaultAsync(
                    u => u.WalletId != null && u.WalletId.ToUpper() == recipientWalletIdUpper
                );

                if (receiver == null)
                {
                    throw new UserFriendlyException("Recipient wallet ID not found.");
                }
            }
            else if (!string.IsNullOrWhiteSpace(input.RecipientEmail))
            {
                receiver = await UserManager.FindByEmailAsync(input.RecipientEmail.Trim());
            }

            if (receiver == null)
            {
                throw new UserFriendlyException("Recipient wallet ID is required.");
            }

            await _walletManager.TransferAsync(
                sender.Id,
                receiver.Id,
                input.Amount,
                input.Description ?? "Wallet Transfer"
            );
        }

        public async Task<VerifyWalletIdOutput> VerifyWalletId(VerifyWalletIdInput input)
        {
            if (string.IsNullOrWhiteSpace(input.WalletId))
            {
                throw new UserFriendlyException("Wallet ID is required.");
            }

            var walletId = input.WalletId.Trim();
            var walletIdUpper = walletId.ToUpper();
            var user = await UserManager.Users.FirstOrDefaultAsync(u => u.WalletId != null && u.WalletId.ToUpper() == walletIdUpper);
            if (user == null)
            {
                throw new UserFriendlyException("Wallet ID not found.");
            }

            return new VerifyWalletIdOutput
            {
                WalletId = user.WalletId,
                FullName = $"{user.Name} {user.Surname}".Trim()
            };
        }

        public async Task<ListResultDto<WalletTransactionDto>> GetTransactions()
        {
            var user = await GetCurrentUserAsync();
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == user.Id);
            if (wallet == null) return new ListResultDto<WalletTransactionDto>();

            var transactions = await _transactionRepository.GetAll()
                .Where(t => t.WalletId == wallet.Id)
                .OrderByDescending(t => t.CreationTime)
                .ToListAsync();

            return new ListResultDto<WalletTransactionDto>(
                ObjectMapper.Map<List<WalletTransactionDto>>(transactions)
            );
        }
    }
}
