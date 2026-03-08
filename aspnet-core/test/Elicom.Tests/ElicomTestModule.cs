using Abp.AutoMapper;
using Abp.Configuration.Startup;
using Abp.Dependency;
using Abp.Modules;
using Abp.Net.Mail;
using Abp.TestBase;
using Abp.Zero.Configuration;
using Abp.Zero.EntityFrameworkCore;
using Elicom.EntityFrameworkCore;
using Elicom.Tests.DependencyInjection;
using Castle.MicroKernel.Registration;
using NSubstitute;
using System;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;

namespace Elicom.Tests;

[DependsOn(
    typeof(ElicomApplicationModule),
    typeof(ElicomEntityFrameworkModule),
    typeof(AbpTestBaseModule)
    )]
public class ElicomTestModule : AbpModule
{
    public ElicomTestModule(ElicomEntityFrameworkModule abpProjectNameEntityFrameworkModule)
    {
        abpProjectNameEntityFrameworkModule.SkipDbContextRegistration = true;
        abpProjectNameEntityFrameworkModule.SkipDbSeed = true;
    }

    public override void PreInitialize()
    {
        Configuration.UnitOfWork.Timeout = TimeSpan.FromMinutes(30);
        Configuration.UnitOfWork.IsTransactional = false;

        // Disable static mapper usage since it breaks unit tests (see https://github.com/aspnetboilerplate/aspnetboilerplate/issues/2052)
        Configuration.Modules.AbpAutoMapper().UseStaticMapper = false;

        Configuration.BackgroundJobs.IsJobExecutionEnabled = false;

        // Use database for language management
        Configuration.Modules.Zero().LanguageManagement.EnableDbLocalization();

        RegisterFakeService<AbpZeroDbMigrator<ElicomDbContext>>();

        var testConfiguration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string>
            {
                ["App:ServerRootAddress"] = "http://localhost:44311",
                ["App:ClientRootAddress"] = "http://localhost:4200",
                ["FileStorage:LocalRootPath"] = "C:\\data\\uploads",
                ["FileStorage:RequestPath"] = "/uploads",
                ["EmailSettings:EnableSsl"] = "false"
            })
            .Build();
        IocManager.IocContainer.Register(
            Component.For<IConfiguration>()
                .Instance(testConfiguration)
                .LifestyleSingleton()
                .IsDefault()
        );

        Configuration.ReplaceService<IEmailSender, NullEmailSender>(DependencyLifeStyle.Transient);
    }

    public override void Initialize()
    {
        ServiceCollectionRegistrar.Register(IocManager);
    }

    private void RegisterFakeService<TService>() where TService : class
    {
        IocManager.IocContainer.Register(
            Component.For<TService>()
                .UsingFactoryMethod(() => Substitute.For<TService>())
                .LifestyleSingleton()
        );
    }
}
