using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
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
    public class SmartStoreWalletAppService : ElicomAppServiceBase, ISmartStoreWalletAppService
    {
        private readonly ISmartStoreWalletManager _walletManager;
        private readonly IRepository<SmartStoreWallet, Guid> _walletRepository;
        private readonly IRepository<SmartStoreWalletTransaction, Guid> _transactionRepository;

        public SmartStoreWalletAppService(
            ISmartStoreWalletManager walletManager,
            IRepository<SmartStoreWallet, Guid> walletRepository,
            IRepository<SmartStoreWalletTransaction, Guid> transactionRepository)
        {
            _walletManager = walletManager;
            _walletRepository = walletRepository;
            _transactionRepository = transactionRepository;
        }

        public async Task<SmartStoreWalletDto> GetMyWallet()
        {
            var user = await GetCurrentUserAsync();
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == user.Id);
            
            if (wallet == null)
            {
                // Domain manager handles creation with defaults
                await _walletManager.GetBalanceAsync(user.Id); 
                wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == user.Id);
            }

            return ObjectMapper.Map<SmartStoreWalletDto>(wallet);
        }

        public async Task<ListResultDto<SmartStoreWalletTransactionDto>> GetTransactions()
        {
            var user = await GetCurrentUserAsync();
            var wallet = await _walletRepository.FirstOrDefaultAsync(w => w.UserId == user.Id);
            if (wallet == null) return new ListResultDto<SmartStoreWalletTransactionDto>();

            var transactions = await _transactionRepository.GetAll()
                .Where(t => t.WalletId == wallet.Id)
                .OrderByDescending(t => t.CreationTime)
                .ToListAsync();

            return new ListResultDto<SmartStoreWalletTransactionDto>(
                ObjectMapper.Map<List<SmartStoreWalletTransactionDto>>(transactions)
            );
        }
    }
}
