using System;
using System.Collections.Generic;

namespace Elicom.Subscriptions.Dto;

public class TenantAdminSubscriptionDto
{
    public int TenantId { get; set; }
    public string TenantName { get; set; }
    public string TenancyName { get; set; }
    public long? AdminUserId { get; set; }
    public string AdminUserName { get; set; }
    public string AdminEmailAddress { get; set; }
    public string ActiveSubscriptionCode { get; set; }
    public string ActiveSubscription { get; set; }
    public string PendingSubscriptionCode { get; set; }
    public string PendingSubscription { get; set; }
}

public class UpdateTenantAdminSubscriptionInput
{
    public long AdminUserId { get; set; }
    public string ActiveSubscriptionCode { get; set; }
    public string PendingSubscriptionCode { get; set; }
}

public class MySubscriptionOverviewDto
{
    public int TenantId { get; set; }
    public long UserId { get; set; }
    public string UserName { get; set; }
    public string ActiveSubscriptionCode { get; set; }
    public string ActiveSubscription { get; set; }
    public string PendingSubscriptionCode { get; set; }
    public string PendingSubscription { get; set; }
    public List<MySubscriptionCardUsageDto> Cards { get; set; } = new();
}

public class MySubscriptionCardUsageDto
{
    public long CardId { get; set; }
    public string MaskedCardNumber { get; set; }
    public string Status { get; set; }
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
    public DateTime NextDailyResetUtc { get; set; }
    public DateTime NextMonthlyResetUtc { get; set; }
}

