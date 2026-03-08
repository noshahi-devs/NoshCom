using System;

namespace Elicom.AdminDashboard.Dto
{
    public class AdminStatsDto
    {
        public decimal TotalRevenue { get; set; }
        public int TotalOrders { get; set; }
        public int ActiveStores { get; set; }
        public int PendingApprovals { get; set; }
        public int TotalCustomers { get; set; }
    }
}
