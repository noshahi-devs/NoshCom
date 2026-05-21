using Abp.Application.Services;
using Abp.IdentityFramework;
using Abp.Runtime.Session;
using Elicom.Authorization.Users;
using Elicom.MultiTenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom;

/// <summary>
/// Derive your application services from this class.
/// </summary>
public abstract class ElicomAppServiceBase : ApplicationService
{
    public TenantManager TenantManager { get; set; }

    public UserManager UserManager { get; set; }

    protected ElicomAppServiceBase()
    {
        LocalizationSourceName = ElicomConsts.LocalizationSourceName;
    }

    protected virtual async Task<User> GetCurrentUserAsync()
    {
        var userId = AbpSession.GetUserId();
        User user = null;

        // 1. Try standard lookup (filtered by current tenant)
        user = await UserManager.FindByIdAsync(userId.ToString());
        
        // 2. Fallback: Disable tenant filters (handles host/cross-tenant scenarios)
        if (user == null)
        {
            using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                user = await UserManager.FindByIdAsync(userId.ToString());
            }
        }

        if (user == null)
        {
            throw new Exception("There is no current user!");
        }

        return user;
    }

    protected virtual Task<Tenant> GetCurrentTenantAsync()
    {
        return TenantManager.GetByIdAsync(AbpSession.GetTenantId());
    }

    protected virtual void CheckErrors(IdentityResult identityResult)
    {
        identityResult.CheckErrors(LocalizationManager);
    }

    /// <summary>
    /// Global Mart UK spans PrimeShip (tenant 2) and EasyFinora (tenant 3).
    /// </summary>
    protected static bool IsGlobalMartUkTenant(int? tenantId) => tenantId == 2 || tenantId == 3;

    /// <summary>
    /// Wallet/cards for Global Mart UK are stored under the linked EasyFinora user when present.
    /// </summary>
    protected async Task<long> ResolveGlobalMartUnifiedUserIdAsync(User user)
    {
        if (!IsGlobalMartUkTenant(user.TenantId))
        {
            return user.Id;
        }

        using (UnitOfWorkManager.Current.DisableFilter(
            Abp.Domain.Uow.AbpDataFilters.MayHaveTenant,
            Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
        {
            var easyFinoraUser = await UserManager.Users
                .FirstOrDefaultAsync(u => u.TenantId == 3 && u.EmailAddress == user.EmailAddress);

            return easyFinoraUser?.Id ?? user.Id;
        }
    }

    /// <summary>
    /// All user ids (tenant 2 + 3) that share the same email for Global Mart UK history queries.
    /// </summary>
    protected async Task<List<long>> GetGlobalMartLinkedUserIdsAsync(User user)
    {
        if (!IsGlobalMartUkTenant(user.TenantId))
        {
            return new List<long> { user.Id };
        }

        using (UnitOfWorkManager.Current.DisableFilter(
            Abp.Domain.Uow.AbpDataFilters.MayHaveTenant,
            Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
        {
            return await UserManager.Users
                .Where(u => (u.TenantId == 2 || u.TenantId == 3) && u.EmailAddress == user.EmailAddress)
                .Select(u => u.Id)
                .Distinct()
                .ToListAsync();
        }
    }
}
