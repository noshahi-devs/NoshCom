using Abp.AutoMapper;
using Abp.Modules;
using Abp.Reflection.Extensions;
using Elicom.Authorization;
using Elicom.Carts.Dto;
using Elicom.Categories.Dto;
using Elicom.CustomerProfiles;
using Elicom.Orders;
using Elicom.Products.Dto;
using Elicom.SupplierOrders;
using Elicom.SupplierOrders.Dto;
using Elicom.Wallets.Dto;
using Elicom.GlobalPay;
using Elicom.Wholesale;
using Elicom.SmartStore;

namespace Elicom;

[DependsOn(
    typeof(ElicomCoreModule),
    typeof(AbpAutoMapperModule))]
public class ElicomApplicationModule : AbpModule
{
    public override void PreInitialize()
    {
        Configuration.Authorization.Providers.Add<ElicomAuthorizationProvider>();
        Configuration.Modules.AbpAutoMapper().Configurators.Add(
            // Scan the assembly for classes which inherit from AutoMapper.Profile
            cfg => cfg.AddMaps(typeof(ElicomApplicationModule).GetAssembly())
        );
    }




    public override void Initialize()
    {
        var thisAssembly = typeof(ElicomApplicationModule).GetAssembly();

        IocManager.RegisterAssemblyByConvention(thisAssembly);
    }
}
