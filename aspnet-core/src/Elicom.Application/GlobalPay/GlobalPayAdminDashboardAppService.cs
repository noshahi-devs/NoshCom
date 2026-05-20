using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Elicom.Authorization;
using Elicom.Authorization.Users;
using Elicom.Entities;
using Elicom.GlobalPay.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.GlobalPay
{
    [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin, PermissionNames.Pages_PrimeShip_Admin)]
    public class GlobalPayAdminDashboardAppService : ElicomAppServiceBase, IGlobalPayAdminDashboardAppService
    {
        private readonly IRepository<User, long> _userRepository;
        private readonly IRepository<DepositRequest, Guid> _depositRequestRepository;
        private readonly IRepository<WithdrawRequest, long> _withdrawRequestRepository;
        private readonly IRepository<SupportTicket, Guid> _supportTicketRepository;
        private readonly IRepository<WalletTransaction, Guid> _walletTransactionRepository;
        private readonly IRepository<AppTransaction, long> _appTransactionRepository;

        public GlobalPayAdminDashboardAppService(
            IRepository<User, long> userRepository,
            IRepository<DepositRequest, Guid> depositRequestRepository,
            IRepository<WithdrawRequest, long> withdrawRequestRepository,
            IRepository<SupportTicket, Guid> supportTicketRepository,
            IRepository<WalletTransaction, Guid> walletTransactionRepository,
            IRepository<AppTransaction, long> appTransactionRepository)
        {
            _userRepository = userRepository;
            _depositRequestRepository = depositRequestRepository;
            _withdrawRequestRepository = withdrawRequestRepository;
            _supportTicketRepository = supportTicketRepository;
            _walletTransactionRepository = walletTransactionRepository;
            _appTransactionRepository = appTransactionRepository;
        }

        public async Task<GlobalPayAdminDashboardStatsDto> GetStats()
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MustHaveTenant, AbpDataFilters.MayHaveTenant))
            {
                var totalUsers = await _userRepository.CountAsync();
                var allDeposits = await _depositRequestRepository.GetAll()
                    .SumAsync(d => (decimal?)d.Amount);
                var allWithdraws = await _withdrawRequestRepository.GetAll()
                    .SumAsync(w => (decimal?)w.Amount);
                var pendingDeposits = await _depositRequestRepository.GetAll()
                    .CountAsync(d => d.Status == "Pending");
                var pendingWithdrawals = await _withdrawRequestRepository.GetAll()
                    .CountAsync(w => w.Status == "Pending");
                var openTickets = await _supportTicketRepository.GetAll()
                    .CountAsync(t => t.Status == "Open");

                return new GlobalPayAdminDashboardStatsDto
                {
                    TotalUsers = totalUsers,
                    AllDeposits = allDeposits ?? 0m,
                    AllWithdraws = allWithdraws ?? 0m,
                    PendingDeposits = pendingDeposits,
                    PendingWithdrawals = pendingWithdrawals,
                    OpenTickets = openTickets,
                    TotalTransactionVolume = (allDeposits ?? 0m) + (allWithdraws ?? 0m)
                };
            }
        }
    }
}
