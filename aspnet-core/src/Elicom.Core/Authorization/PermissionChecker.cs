using Abp;
using Abp.Authorization;
using Elicom.Authorization.Roles;
using Elicom.Authorization.Users;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace Elicom.Authorization;

public class PermissionChecker : PermissionChecker<Role, User>
{
    private readonly UserManager _userManager;

    public PermissionChecker(UserManager userManager)
        : base(userManager)
    {
        _userManager = userManager;
    }

    public override async Task<bool> IsGrantedAsync(UserIdentifier user, string permissionName)
    {
        if (await ShouldDenyAdminPermissionAsync(user, permissionName))
        {
            return false;
        }

        return await base.IsGrantedAsync(user, permissionName);
    }

    public override bool IsGranted(UserIdentifier user, string permissionName)
    {
        if (ShouldDenyAdminPermissionAsync(user, permissionName).GetAwaiter().GetResult())
        {
            return false;
        }

        return base.IsGranted(user, permissionName);
    }

    private async Task<bool> ShouldDenyAdminPermissionAsync(UserIdentifier user, string permissionName)
    {
        if (!IsAdminPermission(permissionName))
        {
            return false;
        }

        var appUser = await _userManager.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == user.UserId);

        if (appUser == null)
        {
            return true;
        }

        return !IsAllowedAdminEmail(appUser.TenantId, appUser.EmailAddress);
    }

    private static bool IsAdminPermission(string permissionName)
    {
        return string.Equals(permissionName, PermissionNames.Admin, StringComparison.OrdinalIgnoreCase) ||
               permissionName.EndsWith(".Admin", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsAllowedAdminEmail(int? tenantId, string emailAddress)
    {
        var email = (emailAddress ?? string.Empty).Trim().ToLowerInvariant();

        return tenantId switch
        {
            1 => email == "secureadmin@wc.com",
            2 => email == "secureadmin@ps.com",
            3 or 4 => email == "secureadmin@ef.com",
            _ => false
        };
    }
}
