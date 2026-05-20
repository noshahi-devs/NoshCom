using System.Threading.Tasks;
using Abp.Application.Services;
using Abp.Authorization;
using Abp.Domain.Uow;
using Abp.EntityFrameworkCore;
using Elicom.AdminDashboard.Dto;
using Elicom.Authorization;
using Elicom.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Elicom.AdminDashboard
{
    [AbpAuthorize(PermissionNames.Pages_Users)] // Basic admin-level permission
    public class AdminDashboardAppService : ElicomAppServiceBase
    {
        private readonly IDbContextProvider<ElicomDbContext> _dbContextProvider;

        public AdminDashboardAppService(IDbContextProvider<ElicomDbContext> dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task<AdminStatsDto> GetStats()
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var db = await _dbContextProvider.GetDbContextAsync();

                // Single round-trip to remote SQL — avoids 6 sequential network calls.
                var stats = await db.Database
                    .SqlQuery<AdminStatsDto>($@"
                        SELECT
                            CAST((SELECT COALESCE(SUM(o.TotalAmount), 0) FROM Orders o WHERE o.Status = N'Delivered' AND o.IsDeleted = 0) AS decimal(18,2)) AS TotalRevenue,
                            (SELECT COUNT(*) FROM Orders o WHERE o.IsDeleted = 0) AS TotalOrders,
                            (SELECT COUNT(*) FROM Stores s) AS TotalSellers,
                            (SELECT COUNT(*) FROM Stores s WHERE s.Status = 1) AS ActiveStores,
                            (SELECT COUNT(*) FROM Stores s WHERE s.Status = 0) AS PendingApprovals,
                            (SELECT COUNT(*) FROM StoreProducts sp WHERE sp.Status = 1) AS ActiveProducts,
                            CAST(0 AS int) AS TotalCustomers")
                    .SingleAsync();

                return stats;
            }
        }
    }
}
