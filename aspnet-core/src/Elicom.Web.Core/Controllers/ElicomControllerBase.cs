using Abp.AspNetCore.Mvc.Controllers;
using Abp.IdentityFramework;
using Microsoft.AspNetCore.Identity;

namespace Elicom.Controllers
{
    public abstract class ElicomControllerBase : AbpController
    {
        protected ElicomControllerBase()
        {
            LocalizationSourceName = ElicomConsts.LocalizationSourceName;
        }

        protected void CheckErrors(IdentityResult identityResult)
        {
            identityResult.CheckErrors(LocalizationManager);
        }
    }
}
