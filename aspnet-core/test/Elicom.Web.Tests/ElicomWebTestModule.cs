using Abp.AspNetCore;
using Abp.AspNetCore.TestBase;
using Abp.Modules;
using Abp.Reflection.Extensions;
using Elicom.EntityFrameworkCore;
using Elicom.Web.Startup;
using Microsoft.AspNetCore.Mvc.ApplicationParts;

namespace Elicom.Web.Tests;

[DependsOn(
    typeof(ElicomWebCoreModule),
    typeof(AbpAspNetCoreTestBaseModule)
)]
public class ElicomWebTestModule : AbpModule
{
    public ElicomWebTestModule(ElicomEntityFrameworkModule abpProjectNameEntityFrameworkModule)
    {
        abpProjectNameEntityFrameworkModule.SkipDbContextRegistration = true;
    }

    public override void PreInitialize()
    {
        Configuration.UnitOfWork.IsTransactional = false; //EF Core InMemory DB does not support transactions.
    }

    public override void Initialize()
    {
        IocManager.RegisterAssemblyByConvention(typeof(ElicomWebTestModule).GetAssembly());
    }

    public override void PostInitialize()
    {
        IocManager.Resolve<ApplicationPartManager>()
            .AddApplicationPartsIfNotAddedBefore(typeof(ElicomWebCoreModule).Assembly);
    }
}