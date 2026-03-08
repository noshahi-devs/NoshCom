using Abp.Authorization;
using Abp.Localization;
using Abp.MultiTenancy;

namespace Elicom.Authorization;

public class ElicomAuthorizationProvider : AuthorizationProvider
{
    public override void SetPermissions(IPermissionDefinitionContext context)
    {
        context.CreatePermission(PermissionNames.Admin, L("Admin"));
        context.CreatePermission(PermissionNames.Pages_Users, L("Users"));
        context.CreatePermission(PermissionNames.Pages_Users_Activation, L("UsersActivation"));
        context.CreatePermission(PermissionNames.Pages_Roles, L("Roles"));
        context.CreatePermission(PermissionNames.Pages_Tenants, L("Tenants"), multiTenancySides: MultiTenancySides.Host);

        var categories = context.CreatePermission(PermissionNames.Pages_Categories, L("Categories"));
        categories.CreateChildPermission(PermissionNames.Pages_Categories_Create, L("CreateCategory"));
        categories.CreateChildPermission(PermissionNames.Pages_Categories_Edit, L("EditCategory"));
        categories.CreateChildPermission(PermissionNames.Pages_Categories_Delete, L("DeleteCategory"));

        var products = context.CreatePermission(
            PermissionNames.Pages_Products,
            L("Products")
        );
        products.CreateChildPermission(
            PermissionNames.Pages_Products_Create,
            L("CreateProduct")
        );
        products.CreateChildPermission(
            PermissionNames.Pages_Products_Edit,
            L("EditProduct")
        );
        products.CreateChildPermission(
            PermissionNames.Pages_Products_Delete,
            L("DeleteProduct")
        );


        var stores = context.CreatePermission(PermissionNames.Pages_Stores, L("Stores"));
        stores.CreateChildPermission(PermissionNames.Pages_Stores_Create, L("CreateStore"));
        stores.CreateChildPermission(PermissionNames.Pages_Stores_Edit, L("EditStore"));
        stores.CreateChildPermission(PermissionNames.Pages_Stores_Delete, L("DeleteStore"));
        
        // Add a flat "Stores" permission for compatibility with any legacy checks
        context.CreatePermission("Stores", L("Stores"));

        var storeProducts = context.CreatePermission(
            PermissionNames.Pages_StoreProducts, L("StoreProducts"));

            storeProducts.CreateChildPermission(
            PermissionNames.Pages_StoreProducts_Create, L("CreateStoreProduct"));

            storeProducts.CreateChildPermission(
            PermissionNames.Pages_StoreProducts_Edit, L("EditStoreProduct"));

            storeProducts.CreateChildPermission(
            PermissionNames.Pages_StoreProducts_Delete, L("DeleteStoreProduct"));

        context.CreatePermission(PermissionNames.Pages_Supplier_Products, L("SupplierProducts"));
        context.CreatePermission(PermissionNames.Pages_Reseller_Marketplace, L("ResellerMarketplace"));
        context.CreatePermission(PermissionNames.Pages_Reseller_Store, L("ResellerStore"));

        // Platform specific
        context.CreatePermission(PermissionNames.Pages_GlobalPay, L("GlobalPay"));
        context.CreatePermission(PermissionNames.Pages_GlobalPay_Admin, L("GlobalPayAdmin"));
        context.CreatePermission(PermissionNames.Pages_PrimeShip, L("PrimeShip"));
        context.CreatePermission(PermissionNames.Pages_PrimeShip_Admin, L("PrimeShipAdmin"));
        context.CreatePermission(PermissionNames.Pages_SmartStore, L("SmartStore"));
        context.CreatePermission(PermissionNames.Pages_SmartStore_Seller, L("SmartStoreSeller"));
        context.CreatePermission(PermissionNames.Pages_SmartStore_Admin, L("SmartStoreAdmin"));
    }



    private static ILocalizableString L(string name)
    {
        return new LocalizableString(name, ElicomConsts.LocalizationSourceName);
    }
}
