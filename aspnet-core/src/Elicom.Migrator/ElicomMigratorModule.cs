using Abp.Events.Bus;
using Abp.Modules;
using Abp.Reflection.Extensions;
using Elicom.Configuration;
using Elicom.EntityFrameworkCore;
using Elicom.Migrator.DependencyInjection;
using Castle.MicroKernel.Registration;
using Microsoft.Extensions.Configuration;

namespace Elicom.Migrator;

[DependsOn(typeof(ElicomEntityFrameworkModule))]
public class ElicomMigratorModule : AbpModule
{
    private readonly IConfigurationRoot _appConfiguration;

    public ElicomMigratorModule(ElicomEntityFrameworkModule abpProjectNameEntityFrameworkModule)
    {
        abpProjectNameEntityFrameworkModule.SkipDbSeed = true;

        _appConfiguration = AppConfigurations.Get(
            typeof(ElicomMigratorModule).GetAssembly().GetDirectoryPathOrNull()
        );
    }

    public override void PreInitialize()
    {
        Configuration.DefaultNameOrConnectionString = _appConfiguration.GetConnectionString(
            ElicomConsts.ConnectionStringName
        );

        Configuration.BackgroundJobs.IsJobExecutionEnabled = false;
        Configuration.ReplaceService(
            typeof(IEventBus),
            () => IocManager.IocContainer.Register(
                Component.For<IEventBus>().Instance(NullEventBus.Instance)
            )
        );
    }

    public override void Initialize()
    {
        IocManager.RegisterAssemblyByConvention(typeof(ElicomMigratorModule).GetAssembly());
        ServiceCollectionRegistrar.Register(IocManager);
    }
}
