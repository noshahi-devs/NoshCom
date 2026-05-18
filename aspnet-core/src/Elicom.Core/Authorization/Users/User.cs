using Abp.Authorization.Users;
using Abp.Extensions;
using System;
using System.Collections.Generic;

namespace Elicom.Authorization.Users;

public class User : AbpUser<User>
{
    public const string DefaultPassword = "Elicom#NdiSecure@2026!A9";
    
    public string WalletId { get; set; }
    public string Country { get; set; }

    public static string CreateRandomPassword()
    {
        return Guid.NewGuid().ToString("N").Truncate(16);
    }

    public static User CreateTenantAdminUser(int tenantId, string emailAddress)
    {
        var user = new User
        {
            TenantId = tenantId,
            UserName = AdminUserName,
            Name = AdminUserName,
            Surname = AdminUserName,
            EmailAddress = emailAddress,
            Roles = new List<UserRole>()
        };

        user.SetNormalizedNames();

        return user;
    }
}
