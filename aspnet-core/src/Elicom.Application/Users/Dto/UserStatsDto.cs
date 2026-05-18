using System;

namespace Elicom.Users.Dto
{
    public class UserStatsDto
    {
        public decimal WalletBalance { get; set; }
        public decimal TotalDeposit { get; set; }
        public decimal TotalWithdrawals { get; set; }
        public decimal PendingPayout { get; set; }
        public decimal TotalCardSpending { get; set; }
    }
}
