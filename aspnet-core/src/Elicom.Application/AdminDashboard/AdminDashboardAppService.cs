using System;
using System.Linq;
using System.Threading.Tasks;
using Abp.Application.Services;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Elicom.AdminDashboard.Dto;
using Elicom.Authorization;
using Elicom.Entities;
using Microsoft.EntityFrameworkCore;

namespace Elicom.AdminDashboard
{
    [AbpAuthorize(PermissionNames.Pages_Users)] // Basic admin-level permission
    public class AdminDashboardAppService : ElicomAppServiceBase
    {
        private readonly IRepository<Order, Guid> _orderRepository;
        private readonly IRepository<Store, Guid> _storeRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;

        public AdminDashboardAppService(
            IRepository<Order, Guid> orderRepository,
            IRepository<Store, Guid> storeRepository,
            IRepository<StoreProduct, Guid> storeProductRepository)
        {
            _orderRepository = orderRepository;
            _storeRepository = storeRepository;
            _storeProductRepository = storeProductRepository;
        }

        public async Task<AdminStatsDto> GetStats()
        {
            var totalRevenue = await _orderRepository.GetAll()
                .Where(o => o.Status == "Delivered")
                .SumAsync(o => o.TotalAmount);

            var totalOrders = await _orderRepository.CountAsync();
            
            var activeStores = await _storeRepository.CountAsync(s => s.Status == true);
            var pendingApprovals = await _storeRepository.CountAsync(s => s.Status == false);

            return new AdminStatsDto
            {
                TotalRevenue = totalRevenue,
                TotalOrders = totalOrders,
                ActiveStores = activeStores,
                PendingApprovals = pendingApprovals,
                TotalCustomers = 0 // Will integrate with User repository if needed
            };
        }
    }
}
