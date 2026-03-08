using Abp.Authorization;
using Abp.Domain.Repositories;
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
    [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin)]
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
            // Keep stats consistent for admin monitoring across integrated flows.
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant))
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var totalUsersTask = _userRepository.CountAsync();
                var pendingDepositsTask = _depositRequestRepository.GetAll()
                    .CountAsync(d => d.Status == "Pending");
                var pendingWithdrawalsTask = _withdrawRequestRepository.GetAll()
                    .CountAsync(w => w.Status == "Pending");
                var openTicketsTask = _supportTicketRepository.GetAll()
                    .CountAsync(t => t.Status == "Open");

                // Sum absolute values from both wallet and card transaction streams.
                var walletVolumeTask = _walletTransactionRepository.GetAll()
                    .Select(t => Math.Abs(t.Amount))
                    .DefaultIfEmpty(0m)
                    .SumAsync();

                var cardVolumeTask = _appTransactionRepository.GetAll()
                    .Select(t => Math.Abs(t.Amount))
                    .DefaultIfEmpty(0m)
                    .SumAsync();

                await Task.WhenAll(
                    totalUsersTask,
                    pendingDepositsTask,
                    pendingWithdrawalsTask,
                    openTicketsTask,
                    walletVolumeTask,
                    cardVolumeTask
                );

                return new GlobalPayAdminDashboardStatsDto
                {
                    TotalUsers = totalUsersTask.Result,
                    PendingDeposits = pendingDepositsTask.Result,
                    PendingWithdrawals = pendingWithdrawalsTask.Result,
                    OpenTickets = openTicketsTask.Result,
                    TotalTransactionVolume = walletVolumeTask.Result + cardVolumeTask.Result
                };
            }
        }
    }
}
