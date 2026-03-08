using Abp.Application.Services;
using Abp.IdentityFramework;
using Abp.Runtime.Session;
using Elicom.Authorization.Users;
using Elicom.MultiTenancy;
using Microsoft.AspNetCore.Identity;
using System;
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
}
