using Abp.Application.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Elicom.Orders.Dto;

namespace Elicom.SellerDashboard
{
    public interface ISellerDashboardAppService : IApplicationService
    {
        Task<SellerDashboardStatsDto> GetStats(Guid storeId, DateTime? startDate, DateTime? endDate);
        Task<List<OrderPaymentTransactionDto>> GetSaleTransactions(Guid storeId, DateTime? startDate, DateTime? endDate);
    }

    public class SellerDashboardStatsDto
    {
        public int ActiveListings { get; set; }
        public decimal TotalSales { get; set; }
        public int TotalOrders { get; set; }
        public int PendingOrders { get; set; }
        public int ShippedOrders { get; set; }
        public int DeliveredOrders { get; set; }
        
        public decimal TotalIncome { get; set; }
        public decimal TotalExpense { get; set; }
        public int NewCustomers { get; set; }
        
        public decimal WalletBalance { get; set; }
        public decimal PayoutTillNow { get; set; }
        public decimal RecentPayout { get; set; }
        public decimal AcReserve { get; set; }
        
        public int UnitsOrdered { get; set; }
        public decimal AvgUnitsPerOrder { get; set; }
        public int BulkOrdersCount { get; set; }
        
        // New Fields for Stats Pages
        public decimal ZalandoFees { get; set; }
        public decimal AvgSalePerOrder { get; set; }
        public decimal EstPayout { get; set; }
        public decimal TotalRefunds { get; set; }
        public decimal NetProfit { get; set; }
        public decimal NetProfitMargin { get; set; }

        public List<OrderDto> RecentOrders { get; set; }
        
        public List<decimal> WeeklyRevenue { get; set; }
        public List<int> WeeklyOrderCount { get; set; }
    }

    public class OrderPaymentTransactionDto
    {
        public Guid OrderId { get; set; }
        public string OrderFriendlyId { get; set; }
        public decimal SaleRevenue { get; set; }
        public decimal Fee { get; set; }
        public decimal NetProfit { get; set; }
        public decimal ProfitMargin { get; set; }
        public string Status { get; set; }
        public DateTime CreationTime { get; set; }
    }
}
