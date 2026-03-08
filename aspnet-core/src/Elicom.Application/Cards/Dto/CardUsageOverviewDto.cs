using System;

namespace Elicom.Cards.Dto
{
    public class CardUsageOverviewDto
    {
        public long CardId { get; set; }
        public string PlanCode { get; set; }
        public string PlanName { get; set; }

        public int DailyTransactionLimit { get; set; }
        public int DailyTransactionUsed { get; set; }
        public int DailyTransactionRemaining { get; set; }

        public int MonthlyTransactionLimit { get; set; }
        public int MonthlyTransactionUsed { get; set; }
        public int MonthlyTransactionRemaining { get; set; }

        public decimal DailyAmountLimit { get; set; }
        public decimal DailyAmountUsed { get; set; }
        public decimal DailyAmountRemaining { get; set; }

        public decimal MonthlyAmountLimit { get; set; }
        public decimal MonthlyAmountUsed { get; set; }
        public decimal MonthlyAmountRemaining { get; set; }

        public DateTime UsageDayStartUtc { get; set; }
        public DateTime UsageMonthStartUtc { get; set; }
        public DateTime NextDailyResetUtc { get; set; }
        public DateTime NextMonthlyResetUtc { get; set; }
    }
}
