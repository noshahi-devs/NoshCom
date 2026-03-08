namespace Elicom.Cards.Dto
{
    public class UserBalanceDto
    {
        public decimal TotalBalance { get; set; }
        public decimal PendingDeposit { get; set; }
        public decimal PendingWithdrawal { get; set; }
        public string Currency { get; set; } = "USD";
    }
}
