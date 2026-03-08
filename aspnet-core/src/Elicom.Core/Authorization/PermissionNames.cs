namespace Elicom.Authorization;

public static class PermissionNames
{
    // Legacy compatibility permission used by older authorization attributes.
    public const string Admin = "Admin";

    public const string Pages_Tenants = "Pages.Tenants";

    public const string Pages_Users = "Pages.Users";
    public const string Pages_Users_Activation = "Pages.Users.Activation";

    public const string Pages_Roles = "Pages.Roles";

    public const string Pages_Categories = "Pages.Categories";
    public const string Pages_Categories_Create = "Pages.Categories.Create";
    public const string Pages_Categories_Edit = "Pages.Categories.Edit";
    public const string Pages_Categories_Delete = "Pages.Categories.Delete";

    public const string Pages_Products = "Pages.Products";
    public const string Pages_Products_Create = "Pages.Products.Create";
    public const string Pages_Products_Edit = "Pages.Products.Edit";
    public const string Pages_Products_Delete = "Pages.Products.Delete";

    public const string Pages_Stores = "Pages.Stores";
    public const string Pages_Stores_Create = "Pages.Stores.Create";
    public const string Pages_Stores_Edit = "Pages.Stores.Edit";
    public const string Pages_Stores_Delete = "Pages.Stores.Delete";

    public const string Pages_StoreProducts = "Pages.StoreProducts";
    public const string Pages_StoreProducts_Create = "Pages.StoreProducts.Create";
    public const string Pages_StoreProducts_Edit = "Pages.StoreProducts.Edit";
    public const string Pages_StoreProducts_Delete = "Pages.StoreProducts.Delete";

    public const string Pages_Supplier_Products = "Pages.Supplier.Products";
    public const string Pages_Reseller_Marketplace = "Pages.Reseller.Marketplace";
    public const string Pages_Reseller_Store = "Pages.Reseller.Store";

    // GlobalPayUK Permissions
    public const string Pages_GlobalPay = "Pages.GlobalPay";
    public const string Pages_GlobalPay_Admin = "Pages.GlobalPay.Admin";

    // PrimeShipUK Permissions
    public const string Pages_PrimeShip = "Pages.PrimeShip";
    public const string Pages_PrimeShip_Admin = "Pages.PrimeShip.Admin";

    // SmartStore Permissions
    public const string Pages_SmartStore = "Pages.SmartStore";
    public const string Pages_SmartStore_Seller = "Pages.SmartStore.Seller";
    public const string Pages_SmartStore_Admin = "Pages.SmartStore.Admin";
}
