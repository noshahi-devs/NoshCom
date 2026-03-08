using Abp.Authorization;
using Elicom.Authorization.Roles;
using Elicom.Authorization.Users;

namespace Elicom.Authorization;

public class PermissionChecker : PermissionChecker<Role, User>
{
    public PermissionChecker(UserManager userManager)
        : base(userManager)
    {
    }
}
