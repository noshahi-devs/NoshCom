using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.UI;
using Elicom.Entities;
using Elicom.Orders.Dto;
using Elicom.Wallets;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.SellerDashboard
{
    [AbpAuthorize]
    public class SellerDashboardAppService : ElicomAppServiceBase, ISellerDashboardAppService
    {
        private readonly IRepository<Store, Guid> _storeRepository;
        private readonly IRepository<Order, Guid> _orderRepository;
        private readonly IRepository<OrderItem, Guid> _orderItemRepository;
        private readonly IRepository<SupplierOrder, Guid> _supplierOrderRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;
        private readonly IRepository<SmartStoreWalletTransaction, Guid> _smartStoreWalletTransactionRepository;
        private readonly ISmartStoreWalletManager _smartStoreWalletManager;

        public SellerDashboardAppService(
            IRepository<Store, Guid> storeRepository,
            IRepository<Order, Guid> orderRepository,
            IRepository<OrderItem, Guid> orderItemRepository,
            IRepository<SupplierOrder, Guid> supplierOrderRepository,
            IRepository<StoreProduct, Guid> storeProductRepository,
            IRepository<SmartStoreWalletTransaction, Guid> smartStoreWalletTransactionRepository,
            ISmartStoreWalletManager smartStoreWalletManager)
        {
            _storeRepository = storeRepository;
            _orderRepository = orderRepository;
            _orderItemRepository = orderItemRepository;
            _supplierOrderRepository = supplierOrderRepository;
            _storeProductRepository = storeProductRepository;
            _smartStoreWalletTransactionRepository = smartStoreWalletTransactionRepository;
            _smartStoreWalletManager = smartStoreWalletManager;
        }

        public async Task<SellerDashboardStatsDto> GetStats(Guid storeId)
        {
            var user = await GetCurrentUserAsync();

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                // Allow Guid.Empty as "my aggregate seller stats" fallback.
                if (storeId != Guid.Empty)
                {
                    var store = await _storeRepository.GetAll()
                        .FirstOrDefaultAsync(s => s.Id == storeId);

                    if (store == null)
                    {
                        throw new UserFriendlyException("Store not found.");
                    }

                    if (store.OwnerId != user.Id)
                    {
                        throw new UserFriendlyException("You are not authorized to view this store dashboard.");
                    }
                }

                var sellerStores = await _storeRepository.GetAll()
                    .Where(s => s.OwnerId == user.Id)
                    .Select(s => new { s.Id, s.Name })
                    .ToListAsync();

                var sellerStoreIds = sellerStores.Select(s => s.Id).Distinct().ToList();
                var sellerStoreNames = sellerStores
                    .Select(s => (s.Name ?? string.Empty).Trim())
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct()
                    .ToList();

                var storeProductIds = await _storeProductRepository.GetAll()
                    .Where(sp => sellerStoreIds.Contains(sp.StoreId))
                    .Select(sp => sp.Id)
                    .ToListAsync();

                var listedProductsCount = await _storeProductRepository.GetAll()
                    .Where(sp => sellerStoreIds.Contains(sp.StoreId))
                    .CountAsync();

                var storeOrderItems = await _orderItemRepository.GetAll()
                    .Include(oi => oi.Order)
                    .Where(oi =>
                        storeProductIds.Contains(oi.StoreProductId) ||
                        (!string.IsNullOrEmpty(oi.StoreName) && sellerStoreNames.Contains(oi.StoreName)))
                    .ToListAsync();

                var activeListings = listedProductsCount > 0
                    ? listedProductsCount
                    : storeOrderItems.Select(oi => oi.StoreProductId).Distinct().Count();

                var storeOrders = storeOrderItems
                    .Where(oi => oi.Order != null)
                    .Select(oi => oi.Order)
                    .GroupBy(o => o.Id)
                    .Select(g => g.First())
                    .OrderByDescending(o => o.CreationTime)
                    .ToList();

                var storeOrderIds = storeOrders.Select(o => o.Id).ToList();

                var recentOrdersEntities = await _orderRepository.GetAll()
                    .Include(o => o.OrderItems)
                    .Where(o => storeOrderIds.Contains(o.Id))
                    .OrderByDescending(o => o.CreationTime)
                    .Take(5)
                    .ToListAsync();

                var totalIncome = storeOrderItems.Sum(oi => oi.PriceAtPurchase * oi.Quantity);

                var totalExpense = await _supplierOrderRepository.GetAll()
                    .Where(so => so.ResellerId == user.Id && so.OrderId.HasValue && storeOrderIds.Contains(so.OrderId.Value))
                    .SumAsync(so => so.TotalPurchaseAmount);

                var totalUnits = storeOrderItems.Sum(oi => oi.Quantity);

                var weeklyRevenue = new List<decimal>();
                var weeklyOrderCount = new List<int>();
                for (var offset = 0; offset < 7; offset++)
                {
                    var date = DateTime.UtcNow.Date.AddDays(-6 + offset);

                    weeklyRevenue.Add(storeOrderItems
                        .Where(oi => oi.Order != null && oi.Order.CreationTime.Date == date)
                        .Sum(oi => oi.PriceAtPurchase * oi.Quantity));

                    weeklyOrderCount.Add(storeOrders.Count(o => o.CreationTime.Date == date));
                }

                var completedWalletCredits = _smartStoreWalletTransactionRepository.GetAll()
                    .Where(t => t.Wallet.UserId == user.Id && t.Status == "Completed" && t.Amount > 0);

                var pendingWalletHolds = _smartStoreWalletTransactionRepository.GetAll()
                    .Where(t => t.Wallet.UserId == user.Id && t.Status == "Pending" && t.Amount < 0);

                var zalandoFees = totalIncome * 0.08m;
                var netProfit = totalIncome - totalExpense - zalandoFees;

                var stats = new SellerDashboardStatsDto
                {
                    ActiveListings = activeListings,
                    TotalSales = totalIncome,
                    TotalOrders = storeOrders.Count,
                    PendingOrders = storeOrders.Count(o => o.Status == "Pending" || o.Status == "PendingVerification"),
                    ShippedOrders = storeOrders.Count(o =>
                        o.Status == "Shipped" ||
                        o.Status == "Processing" ||
                        o.Status == "ShippedFromHub" ||
                        o.Status == "Verified"),
                    DeliveredOrders = storeOrders.Count(o => o.Status == "Delivered"),

                    TotalIncome = totalIncome,
                    TotalExpense = totalExpense,
                    NewCustomers = storeOrders.Select(o => o.UserId).Distinct().Count(),

                    WalletBalance = await _smartStoreWalletManager.GetBalanceAsync(user.Id),

                    PayoutTillNow = await completedWalletCredits
                        .SumAsync(t => Math.Abs(t.Amount)),
                    RecentPayout = await completedWalletCredits
                        .OrderByDescending(t => t.CreationTime)
                        .Select(t => Math.Abs(t.Amount))
                        .FirstOrDefaultAsync(),
                    AcReserve = await pendingWalletHolds
                        .SumAsync(t => Math.Abs(t.Amount)),

                    UnitsOrdered = totalUnits,
                    AvgUnitsPerOrder = storeOrders.Count > 0 ? (decimal)totalUnits / storeOrders.Count : 0,
                    BulkOrdersCount = storeOrders.Count(o => storeOrderItems
                        .Where(oi => oi.OrderId == o.Id)
                        .Sum(oi => oi.Quantity) > 5),

                    // New Fields implementation
                    ZalandoFees = zalandoFees,
                    AvgSalePerOrder = storeOrders.Count > 0 ? totalIncome / storeOrders.Count : 0,
                    EstPayout = totalIncome - zalandoFees,
                    TotalRefunds = storeOrders.Where(o => o.Status == "Refunded" || o.Status == "Canceled").Count(),
                    NetProfit = netProfit,
                    NetProfitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,

                    RecentOrders = ObjectMapper.Map<List<OrderDto>>(recentOrdersEntities),

                    WeeklyRevenue = weeklyRevenue,
                    WeeklyOrderCount = weeklyOrderCount
                };

                return stats;
            }
        }

        public async Task<List<OrderPaymentTransactionDto>> GetSaleTransactions(Guid storeId)
        {
            var user = await GetCurrentUserAsync();

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var sellerStores = await _storeRepository.GetAll()
                    .Where(s => s.OwnerId == user.Id)
                    .Select(s => new { s.Id, s.Name })
                    .ToListAsync();

                var sellerStoreIds = sellerStores.Select(s => s.Id).ToList();
                var sellerStoreNames = sellerStores.Select(s => s.Name).ToList();

                var storeProductIds = await _storeProductRepository.GetAll()
                    .Where(sp => sellerStoreIds.Contains(sp.StoreId))
                    .Select(sp => sp.Id)
                    .ToListAsync();

                var storeOrderItems = await _orderItemRepository.GetAll()
                    .Include(oi => oi.Order)
                    .Where(oi =>
                        storeProductIds.Contains(oi.StoreProductId) ||
                        (!string.IsNullOrEmpty(oi.StoreName) && sellerStoreNames.Contains(oi.StoreName)))
                    .ToListAsync();

                var transactions = storeOrderItems
                    .Where(oi => oi.Order != null)
                    .GroupBy(oi => oi.OrderId)
                    .Select(g =>
                    {
                        var first = g.First();
                        var revenue = g.Sum(x => x.PriceAtPurchase * x.Quantity);
                        var fee = revenue * 0.08m;
                        var net = revenue - fee; 
                        return new OrderPaymentTransactionDto
                        {
                            OrderId = first.OrderId,
                            OrderFriendlyId = first.Order?.OrderNumber ?? "N/A",
                            SaleRevenue = revenue,
                            Fee = fee,
                            NetProfit = net,
                            ProfitMargin = revenue > 0 ? (net / revenue) * 100 : 0,
                            Status = "Completed", 
                            CreationTime = first.Order?.CreationTime ?? DateTime.UtcNow
                        };
                    })
                    .OrderByDescending(t => t.CreationTime)
                    .ToList();

                return transactions;
            }
        }
    }
}
