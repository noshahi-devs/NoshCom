using Abp.Authorization;
using Abp.Authorization.Users;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.MultiTenancy;
using Abp.UI;
using Elicom.Authorization;
using Elicom.Authorization.Roles;
using Elicom.Authorization.Users;
using Elicom.Cards;
using Elicom.Configuration;
using Elicom.Entities;
using Elicom.MultiTenancy;
using Elicom.Subscriptions.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Subscriptions;

[AbpAuthorize]
public class SubscriptionAppService : ElicomAppServiceBase, ISubscriptionAppService
{
    private readonly IRepository<Tenant, int> _tenantRepository;
    private readonly IRepository<User, long> _userRepository;
    private readonly IRepository<Role, int> _roleRepository;
    private readonly IRepository<VirtualCard, long> _cardRepository;
    private readonly IRepository<AppTransaction, long> _transactionRepository;

    public SubscriptionAppService(
        IRepository<Tenant, int> tenantRepository,
        IRepository<User, long> userRepository,
        IRepository<Role, int> roleRepository,
        IRepository<VirtualCard, long> cardRepository,
        IRepository<AppTransaction, long> transactionRepository)
    {
        _tenantRepository = tenantRepository;
        _userRepository = userRepository;
        _roleRepository = roleRepository;
        _cardRepository = cardRepository;
        _transactionRepository = transactionRepository;
    }

    [AbpAuthorize(PermissionNames.Pages_Tenants)]
    public async Task<List<TenantAdminSubscriptionDto>> GetHostTenantSubscriptions()
    {
        using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
        {
            var tenants = await _tenantRepository.GetAll()
                .IgnoreQueryFilters()
                .OrderBy(t => t.Name)
                .ToListAsync();

            var tenantIds = tenants.Select(t => t.Id).ToList();

            var adminRoleByTenant = await _roleRepository.GetAll()
                .IgnoreQueryFilters()
                .Where(u =>
                    u.TenantId.HasValue &&
                    tenantIds.Contains(u.TenantId.Value) &&
                    u.Name == StaticRoleNames.Tenants.Admin)
                .ToDictionaryAsync(r => r.TenantId!.Value, r => r.Id);

            var allTenantUsers = await _userRepository.GetAllIncluding(u => u.Roles)
                .IgnoreQueryFilters()
                .Where(u =>
                    u.TenantId.HasValue &&
                    tenantIds.Contains(u.TenantId.Value))
                .ToListAsync();

            var adminUsers = allTenantUsers
                .Where(u =>
                    u.TenantId.HasValue &&
                    adminRoleByTenant.TryGetValue(u.TenantId.Value, out var roleId) &&
                    u.Roles.Any(r => r.RoleId == roleId))
                .OrderBy(u => u.TenantId)
                .ThenBy(u => u.UserName)
                .ToList();

            var result = new List<TenantAdminSubscriptionDto>();
            foreach (var tenant in tenants)
            {
                var tenantAdmins = adminUsers.Where(u => u.TenantId == tenant.Id).ToList();
                if (tenantAdmins.Count == 0)
                {
                    result.Add(await BuildTenantAdminSubscriptionAsync(tenant, null));
                    continue;
                }

                foreach (var adminUser in tenantAdmins)
                {
                    result.Add(await BuildTenantAdminSubscriptionAsync(tenant, adminUser));
                }
            }

            return result;
        }
    }

    [AbpAuthorize(PermissionNames.Pages_Tenants)]
    public async Task<TenantAdminSubscriptionDto> UpdateTenantAdminSubscription(UpdateTenantAdminSubscriptionInput input)
    {
        if (input == null)
        {
            throw new UserFriendlyException("Invalid request.");
        }

        using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
        {
            var adminUser = await _userRepository.GetAll()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Id == input.AdminUserId);

            if (adminUser == null || !adminUser.TenantId.HasValue)
            {
                throw new UserFriendlyException("Tenant admin user not found.");
            }

            var tenant = await _tenantRepository.GetAll()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == adminUser.TenantId.Value);

            if (tenant == null)
            {
                throw new UserFriendlyException("Tenant not found.");
            }

            var active = NormalizePlanCode(input.ActiveSubscriptionCode);
            if (string.IsNullOrWhiteSpace(active))
            {
                active = "free";
            }

            var pending = NormalizePlanCode(input.PendingSubscriptionCode);

            await SettingManager.ChangeSettingForUserAsync(
                new Abp.UserIdentifier(adminUser.TenantId.Value, adminUser.Id),
                AppSettingNames.EasyFinoraActiveSubscriptionCode,
                active);

            await SettingManager.ChangeSettingForUserAsync(
                new Abp.UserIdentifier(adminUser.TenantId.Value, adminUser.Id),
                AppSettingNames.EasyFinoraPendingSubscriptionCode,
                pending);

            return await BuildTenantAdminSubscriptionAsync(tenant, adminUser);
        }
    }

    [AbpAuthorize(PermissionNames.Pages_Users)]
    public async Task<MySubscriptionOverviewDto> GetMySubscriptionOverview()
    {
        var tenantId = AbpSession.TenantId;
        if (!tenantId.HasValue)
        {
            throw new UserFriendlyException("This endpoint is only available for tenant users.");
        }

        var userId = AbpSession.UserId ?? throw new UserFriendlyException("User session is required.");
        var activeCode = await GetUserSettingAsync(tenantId.Value, userId, AppSettingNames.EasyFinoraActiveSubscriptionCode);
        var pendingCode = await GetUserSettingAsync(tenantId.Value, userId, AppSettingNames.EasyFinoraPendingSubscriptionCode);

        if (string.IsNullOrWhiteSpace(activeCode))
        {
            activeCode = "free";
        }

        var cards = await _cardRepository.GetAll()
            .IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId.Value && c.UserId == userId)
            .OrderByDescending(c => c.CreationTime)
            .ToListAsync();

        var cardDtos = new List<MySubscriptionCardUsageDto>(cards.Count);
        foreach (var card in cards)
        {
            cardDtos.Add(await BuildCardUsageAsync(card, activeCode));
        }

        return new MySubscriptionOverviewDto
        {
            TenantId = tenantId.Value,
            UserId = userId,
            UserName = (await UserManager.GetUserByIdAsync(userId)).UserName,
            ActiveSubscriptionCode = activeCode,
            ActiveSubscription = GetPlanDisplayName(activeCode),
            PendingSubscriptionCode = pendingCode,
            PendingSubscription = GetPlanDisplayName(pendingCode),
            Cards = cardDtos
        };
    }

    [AbpAuthorize(PermissionNames.Pages_Users)]
    public Task<MySubscriptionOverviewDto> GetActiveTenantSubscription()
    {
        // Backward-compatible alias for older clients still calling
        // /api/services/app/Subscription/GetActiveTenantSubscription.
        return GetMySubscriptionOverview();
    }

    private async Task<TenantAdminSubscriptionDto> BuildTenantAdminSubscriptionAsync(Tenant tenant, User adminUser)
    {
        var activeCode = "free";
        var pendingCode = string.Empty;

        if (adminUser != null)
        {
            activeCode = await GetUserSettingAsync(tenant.Id, adminUser.Id, AppSettingNames.EasyFinoraActiveSubscriptionCode);
            pendingCode = await GetUserSettingAsync(tenant.Id, adminUser.Id, AppSettingNames.EasyFinoraPendingSubscriptionCode);
        }

        if (string.IsNullOrWhiteSpace(activeCode))
        {
            activeCode = "free";
        }

        return new TenantAdminSubscriptionDto
        {
            TenantId = tenant.Id,
            TenantName = tenant.Name,
            TenancyName = tenant.TenancyName,
            AdminUserId = adminUser?.Id,
            AdminUserName = adminUser?.UserName,
            AdminEmailAddress = adminUser?.EmailAddress,
            ActiveSubscriptionCode = activeCode,
            ActiveSubscription = GetPlanDisplayName(activeCode),
            PendingSubscriptionCode = pendingCode,
            PendingSubscription = GetPlanDisplayName(pendingCode)
        };
    }

    private async Task<MySubscriptionCardUsageDto> BuildCardUsageAsync(VirtualCard card, string activePlanCode)
    {
        var limits = GetSubscriptionLimit(activePlanCode);
        var nowUtc = DateTime.UtcNow;
        var dayStartUtc = nowUtc.Date;
        var monthStartUtc = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var txQuery = _transactionRepository.GetAll()
            .IgnoreQueryFilters()
            .Where(t =>
                t.TenantId == card.TenantId &&
                t.UserId == card.UserId &&
                t.CardId == card.Id &&
                t.MovementType == "Debit" &&
                t.Category == "Card Transaction" &&
                t.Status == "Approved");

        var dailyCount = await txQuery.Where(t => t.CreationTime >= dayStartUtc).CountAsync();
        var monthlyCount = await txQuery.Where(t => t.CreationTime >= monthStartUtc).CountAsync();

        var dailyAmountUsed = Math.Abs((await txQuery
            .Where(t => t.CreationTime >= dayStartUtc)
            .SumAsync(t => (decimal?)t.Amount)) ?? 0m);

        var monthlyAmountUsed = Math.Abs((await txQuery
            .Where(t => t.CreationTime >= monthStartUtc)
            .SumAsync(t => (decimal?)t.Amount)) ?? 0m);

        return new MySubscriptionCardUsageDto
        {
            CardId = card.Id,
            MaskedCardNumber = MaskCardNumber(card.CardNumber),
            Status = card.Status,
            PlanCode = NormalizePlanCode(activePlanCode),
            PlanName = limits.PlanName,
            DailyTransactionLimit = limits.TransactionsPerDay,
            DailyTransactionUsed = dailyCount,
            DailyTransactionRemaining = Math.Max(0, limits.TransactionsPerDay - dailyCount),
            MonthlyTransactionLimit = limits.TransactionsPerMonth,
            MonthlyTransactionUsed = monthlyCount,
            MonthlyTransactionRemaining = Math.Max(0, limits.TransactionsPerMonth - monthlyCount),
            DailyAmountLimit = limits.DailyAmountLimit,
            DailyAmountUsed = dailyAmountUsed,
            DailyAmountRemaining = Math.Max(0m, limits.DailyAmountLimit - dailyAmountUsed),
            MonthlyAmountLimit = limits.MonthlyAmountLimit,
            MonthlyAmountUsed = monthlyAmountUsed,
            MonthlyAmountRemaining = Math.Max(0m, limits.MonthlyAmountLimit - monthlyAmountUsed),
            NextDailyResetUtc = dayStartUtc.AddDays(1),
            NextMonthlyResetUtc = monthStartUtc.AddMonths(1)
        };
    }

    private async Task<string> GetUserSettingAsync(int tenantId, long userId, string settingName)
    {
        var value = await SettingManager.GetSettingValueForUserAsync(
            settingName,
            new Abp.UserIdentifier(tenantId, userId));

        return NormalizePlanCode(value);
    }

    private static string NormalizePlanCode(string planCode)
    {
        if (string.IsNullOrWhiteSpace(planCode))
        {
            return string.Empty;
        }

        var normalized = planCode.Trim().ToLowerInvariant();
        return normalized switch
        {
            "free" => "free",
            "standard" => "standard",
            "premium" => "premium",
            "business-plus" => "business-plus",
            _ => throw new UserFriendlyException($"Unsupported plan code: {planCode}")
        };
    }

    private static SubscriptionLimit GetSubscriptionLimit(string planCode)
    {
        return NormalizePlanCode(planCode) switch
        {
            "standard" => new SubscriptionLimit("Standard", 300m, 2500m, 5, 50),
            "premium" => new SubscriptionLimit("Premium", 500m, 5000m, 10, 100),
            "business-plus" => new SubscriptionLimit("Business Plus", 2000m, 50000m, 20, 500),
            _ => new SubscriptionLimit("Free", 150m, 1500m, 3, 15)
        };
    }

    private static string GetPlanDisplayName(string planCode)
    {
        var normalized = NormalizePlanCode(string.IsNullOrWhiteSpace(planCode) ? "free" : planCode);
        return normalized switch
        {
            "standard" => "Standard",
            "premium" => "Premium",
            "business-plus" => "Business Plus",
            _ => "Free"
        };
    }

    private static string MaskCardNumber(string cardNumber)
    {
        if (string.IsNullOrWhiteSpace(cardNumber))
        {
            return string.Empty;
        }

        var digits = new string(cardNumber.Where(char.IsDigit).ToArray());
        if (digits.Length <= 4)
        {
            return digits;
        }

        var last4 = digits[^4..];
        return $"**** **** **** {last4}";
    }

    private sealed class SubscriptionLimit
    {
        public SubscriptionLimit(string planName, decimal dailyAmountLimit, decimal monthlyAmountLimit, int transactionsPerDay, int transactionsPerMonth)
        {
            PlanName = planName;
            DailyAmountLimit = dailyAmountLimit;
            MonthlyAmountLimit = monthlyAmountLimit;
            TransactionsPerDay = transactionsPerDay;
            TransactionsPerMonth = transactionsPerMonth;
        }

        public string PlanName { get; }
        public decimal DailyAmountLimit { get; }
        public decimal MonthlyAmountLimit { get; }
        public int TransactionsPerDay { get; }
        public int TransactionsPerMonth { get; }
    }
}
