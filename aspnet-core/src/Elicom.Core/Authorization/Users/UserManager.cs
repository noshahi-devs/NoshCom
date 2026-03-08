using Abp.Authorization;
using Abp.Authorization.Users;
using Abp.Configuration;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.Organizations;
using Abp.Runtime.Caching;
using Elicom.Authorization.Roles;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using Abp.IdentityFramework;
using System.Threading.Tasks;

namespace Elicom.Authorization.Users;

public class UserManager : AbpUserManager<Role, User>
{
    public UserManager(
      RoleManager roleManager,
      UserStore store,
      IOptions<IdentityOptions> optionsAccessor,
      IPasswordHasher<User> passwordHasher,
      IEnumerable<IUserValidator<User>> userValidators,
      IEnumerable<IPasswordValidator<User>> passwordValidators,
      ILookupNormalizer keyNormalizer,
      IdentityErrorDescriber errors,
      IServiceProvider services,
      ILogger<UserManager<User>> logger,
      IPermissionManager permissionManager,
      IUnitOfWorkManager unitOfWorkManager,
      ICacheManager cacheManager,
      IRepository<OrganizationUnit, long> organizationUnitRepository,
      IRepository<UserOrganizationUnit, long> userOrganizationUnitRepository,
      IOrganizationUnitSettings organizationUnitSettings,
      ISettingManager settingManager,
      IRepository<UserLogin, long> userLoginRepository)
      : base(
          roleManager,
          store,
          optionsAccessor,
          passwordHasher,
          userValidators,
          passwordValidators,
          keyNormalizer,
          errors,
          services,
          logger,
          permissionManager,
          unitOfWorkManager,
          cacheManager,
          organizationUnitRepository,
          userOrganizationUnitRepository,
          organizationUnitSettings,
          settingManager,
          userLoginRepository)
    {
    }

    public override async Task<IdentityResult> CheckDuplicateUsernameOrEmailAddressAsync(long? expectedUserId, string userName, string emailAddress)
    {
        var user = await FindByNameAsync(userName);
        if (user != null && user.Id != expectedUserId)
        {
            return IdentityResult.Failed(new IdentityError { Description = string.Format(L("Identity.DuplicateUserName"), userName) });
        }

        // Allow duplicate emails if the username is platform-prefixed (SS_, PS_, GP_)
        bool isPlatformPrefixed = userName.StartsWith("SS_") || userName.StartsWith("PS_") || userName.StartsWith("GP_");
        
        if (!isPlatformPrefixed)
        {
            user = await FindByEmailAsync(emailAddress);
            if (user != null && user.Id != expectedUserId)
            {
                return IdentityResult.Failed(new IdentityError { Description = string.Format(L("Identity.DuplicateEmail"), emailAddress) });
            }
        }

        return IdentityResult.Success;
    }
}
