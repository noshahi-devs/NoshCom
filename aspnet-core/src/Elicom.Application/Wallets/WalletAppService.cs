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

        private async Task<string> GenerateWalletIdAsync()
        {
            using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var gmUserWalletIds = await UserManager.Users
                    .Where(u => u.WalletId != null && u.WalletId.StartsWith("GM-15UK"))
                    .Select(u => u.WalletId)
                    .ToListAsync();

                long nextNum = 4255;
                if (gmUserWalletIds.Any())
                {
                    var maxNum = gmUserWalletIds
                        .Select(id => id.Substring(7))
                        .Select(numStr => long.TryParse(numStr, out var val) ? val : 0)
                        .Max();
                    nextNum = Math.Max(4255, maxNum + 1);
                }

                return $"GM-15UK{nextNum}";
            }
        }

        private async Task<long> GetEasyFinoraUserIdAsync(User user)
        {
            using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var easyFinoraUser = await UserManager.Users.FirstOrDefaultAsync(u => u.TenantId == 3 && u.EmailAddress == user.EmailAddress);
                return easyFinoraUser != null ? easyFinoraUser.Id : user.Id;
            }
        }

        [Abp.Domain.Uow.UnitOfWork(System.Transactions.TransactionScopeOption.Suppress)]
        public async Task<WalletDto> GetMyWallet()
        {
            var user = await GetCurrentUserAsync();

            // Failsafe 1: If user.WalletId is null/empty or is not sequential (e.g. legacy format), generate a clean sequential one!
            var isSequential = !string.IsNullOrWhiteSpace(user.WalletId) 
                && user.WalletId.StartsWith("GM-15UK") 
                && user.WalletId.Length > 7
                && user.WalletId.Substring(7).All(char.IsDigit);

            if (!isSequential)
            {
                user.WalletId = await GenerateWalletIdAsync();
                await UserManager.UpdateAsync(user);
                await CurrentUnitOfWork.SaveChangesAsync();
            }

            var targetUserId = await GetEasyFinoraUserIdAsync(user);

            // Failsafe 2: Sync generated Wallet ID to EasyFinora (Tenant 3) user if needed
            using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var easyFinoraUser = await UserManager.Users.FirstOrDefaultAsync(u => u.TenantId == 3 && u.EmailAddress == user.EmailAddress);
                if (easyFinoraUser != null && easyFinoraUser.WalletId != user.WalletId)
                {
                    easyFinoraUser.WalletId = user.WalletId;
                    await UserManager.UpdateAsync(easyFinoraUser);
                    await CurrentUnitOfWork.SaveChangesAsync();
                }
            }

            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == targetUserId);
            
            // Auto-create if missing (failsafe)
            if (wallet == null)
            {
                wallet = new Wallet { UserId = targetUserId, Balance = 0, Currency = "PKR" };
                await _walletRepository.InsertAsync(wallet);
                await CurrentUnitOfWork.SaveChangesAsync();
            }

            var dto = ObjectMapper.Map<WalletDto>(wallet);
            dto.DisplayWalletId = user.WalletId;
            return dto;
        }

        public async Task Deposit(DepositInput input)
        {
            var user = await GetCurrentUserAsync();
            var targetUserId = await GetEasyFinoraUserIdAsync(user);
            
            await _walletManager.DepositAsync(
                targetUserId, 
                input.Amount, 
                $"DEP-{DateTime.Now.Ticks}", 
                $"Deposit via {input.Method}"
            );
        }

        public async Task Transfer(TransferInput input)
        {
            var sender = await GetCurrentUserAsync();
            var targetSenderId = await GetEasyFinoraUserIdAsync(sender);

            User receiver = null;

            if (!string.IsNullOrWhiteSpace(input.RecipientWalletId))
            {
                var recipientWalletId = input.RecipientWalletId.Trim();
                var recipientWalletIdUpper = recipientWalletId.ToUpper();

                using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
                {
                    receiver = await UserManager.Users.FirstOrDefaultAsync(
                        u => u.WalletId != null && u.WalletId.ToUpper() == recipientWalletIdUpper
                    );
                }

                if (receiver == null)
                {
                    throw new UserFriendlyException("Recipient wallet ID not found.");
                }
            }
            else if (!string.IsNullOrWhiteSpace(input.RecipientEmail))
            {
                using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
                {
                    receiver = await UserManager.FindByEmailAsync(input.RecipientEmail.Trim());
                }
            }

            if (receiver == null)
            {
                throw new UserFriendlyException("Recipient wallet ID is required.");
            }

            // Transfer to receiver's EasyFinora account
            long targetReceiverId = receiver.Id;
            using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var easyFinoraReceiver = await UserManager.Users.FirstOrDefaultAsync(u => u.TenantId == 3 && u.EmailAddress == receiver.EmailAddress);
                if (easyFinoraReceiver != null)
                {
                    targetReceiverId = easyFinoraReceiver.Id;
                }
            }

            await _walletManager.TransferAsync(
                targetSenderId,
                targetReceiverId,
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
            
            User user = null;
            using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                user = await UserManager.Users.FirstOrDefaultAsync(u => u.WalletId != null && u.WalletId.ToUpper() == walletIdUpper);
            }
            
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
            var targetUserId = await GetEasyFinoraUserIdAsync(user);
            
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == targetUserId);
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
