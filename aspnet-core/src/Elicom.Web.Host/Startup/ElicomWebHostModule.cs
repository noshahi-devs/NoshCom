using Abp.Modules;
using Abp.Reflection.Extensions;
using Elicom.Configuration;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Elicom.Web.Host.Startup
{
    [DependsOn(
       typeof(ElicomWebCoreModule))]
    public class ElicomWebHostModule : AbpModule
    {
        private readonly IWebHostEnvironment _env;
        private readonly IConfigurationRoot _appConfiguration;

        public ElicomWebHostModule(IWebHostEnvironment env)
        {
            _env = env;
            _appConfiguration = env.GetAppConfiguration();
        }

        public override void PreInitialize()
        {
            if (_env.IsDevelopment())
            {
                var jobsEnabled = _appConfiguration.GetValue("BackgroundJobs:IsJobExecutionEnabled", false);
                Configuration.BackgroundJobs.IsJobExecutionEnabled = jobsEnabled;
            }
        }

        public override void Initialize()
        {
            IocManager.RegisterAssemblyByConvention(typeof(ElicomWebHostModule).GetAssembly());
        }
    }
}
