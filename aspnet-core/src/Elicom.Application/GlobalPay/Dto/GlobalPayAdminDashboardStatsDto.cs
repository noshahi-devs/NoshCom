namespace Elicom.GlobalPay.Dto
{
    public class GlobalPayAdminDashboardStatsDto
    {
        public int TotalUsers { get; set; }
        public decimal AllDeposits { get; set; }
        public decimal AllWithdraws { get; set; }
        public int PendingDeposits { get; set; }
        public int PendingWithdrawals { get; set; }
        public int OpenTickets { get; set; }
        public decimal TotalTransactionVolume { get; set; }
    }
}
