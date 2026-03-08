using Abp.Authorization;
using Abp.Authorization.Roles;
using Abp.Authorization.Users;
using Abp.MultiTenancy;
using Elicom.Authorization;
using Elicom.Authorization.Roles;
using Elicom.Authorization.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Linq;

namespace Elicom.EntityFrameworkCore.Seed.Tenants;

public class TenantRoleAndUserBuilder
{
    private readonly ElicomDbContext _context;
    private readonly int _tenantId;

    public TenantRoleAndUserBuilder(ElicomDbContext context, int tenantId)
    {
        _context = context;
        _tenantId = tenantId;
    }

    public void Create()
    {
        CreateRolesAndUsers();
    }

    private void CreateRolesAndUsers()
    {
        var passwordHasher = new PasswordHasher<User>(new OptionsWrapper<PasswordHasherOptions>(new PasswordHasherOptions()));

        // 1. Ensure Roles exist for this tenant
        var adminRole = EnsureRole(StaticRoleNames.Tenants.Admin);
        var supplierRole = EnsureRole(StaticRoleNames.Tenants.Supplier);
        var resellerRole = EnsureRole(StaticRoleNames.Tenants.Reseller);
        var buyerRole = EnsureRole(StaticRoleNames.Tenants.Buyer);
        var sellerRole = EnsureRole(StaticRoleNames.Tenants.Seller);

        // 2. Ensure Admin user exists for this tenant
        var adminUser = _context.Users.IgnoreQueryFilters().FirstOrDefault(u => u.TenantId == _tenantId && u.UserName == AbpUserBase.AdminUserName);
        if (adminUser == null)
        {
            adminUser = User.CreateTenantAdminUser(_tenantId, "admin@defaulttenant.com");
            adminUser.Password = passwordHasher.HashPassword(adminUser, "123qwe");
            adminUser.IsEmailConfirmed = true;
            adminUser.IsActive = true;

            _context.Users.Add(adminUser);
            _context.SaveChanges();

            // Assign Admin role
            _context.UserRoles.Add(new UserRole(_tenantId, adminUser.Id, adminRole.Id));
            _context.SaveChanges();
        }

        // 3. Create platform-specific test users
        CreateVerifiedPlatformUsers(passwordHasher);

        // 4. Grant permissions to roles
        GrantPermissions();
    }

    private Role EnsureRole(string roleName)
    {
        var role = _context.Roles.IgnoreQueryFilters().FirstOrDefault(r => r.TenantId == _tenantId && r.Name == roleName);
        if (role == null)
        {
            role = _context.Roles.Add(new Role(_tenantId, roleName, roleName) { IsStatic = true }).Entity;
            _context.SaveChanges();
        }
        return role;
    }

    private void GrantPermissions()
    {
        // Get roles again to ensure we have tracking entities
        var roles = _context.Roles.IgnoreQueryFilters().Where(r => r.TenantId == _tenantId).ToList();
        
        var supplierRole = roles.FirstOrDefault(r => r.Name == StaticRoleNames.Tenants.Supplier);
        if (supplierRole != null)
        {
            GrantPermissionsIfNotExists(supplierRole, new[] {
                PermissionNames.Pages_PrimeShip,
                PermissionNames.Pages_Reseller_Marketplace,
                PermissionNames.Pages_GlobalPay,
                PermissionNames.Pages_Stores,
                PermissionNames.Pages_Stores_Create,
                PermissionNames.Pages_Stores_Edit,
                PermissionNames.Pages_SmartStore_Seller,
                PermissionNames.Pages_StoreProducts,
                PermissionNames.Pages_StoreProducts_Create,
                PermissionNames.Pages_StoreProducts_Edit,
                PermissionNames.Pages_Supplier_Products
            });
        }

        var resellerRole = roles.FirstOrDefault(r => r.Name == StaticRoleNames.Tenants.Reseller);
        if (resellerRole != null)
        {
            GrantPermissionsIfNotExists(resellerRole, new[] {
                PermissionNames.Pages_PrimeShip,
                PermissionNames.Pages_Reseller_Store,
                PermissionNames.Pages_SmartStore_Seller,
                PermissionNames.Pages_GlobalPay,
                PermissionNames.Pages_Stores,
                PermissionNames.Pages_Stores_Create,
                PermissionNames.Pages_Stores_Edit,
                PermissionNames.Pages_StoreProducts,
                PermissionNames.Pages_StoreProducts_Create,
                PermissionNames.Pages_StoreProducts_Edit
            });
        }

        var sellerRole = roles.FirstOrDefault(r => r.Name == StaticRoleNames.Tenants.Seller);
        if (sellerRole != null)
        {
            GrantPermissionsIfNotExists(sellerRole, new[] {
                PermissionNames.Pages_PrimeShip,
                PermissionNames.Pages_Stores,
                PermissionNames.Pages_Stores_Create,
                PermissionNames.Pages_SmartStore_Seller,
                PermissionNames.Pages_StoreProducts,
                PermissionNames.Pages_StoreProducts_Create,
                PermissionNames.Pages_StoreProducts_Edit,
                PermissionNames.Pages_StoreProducts_Delete
            });
        }

        var buyerRole = roles.FirstOrDefault(r => r.Name == StaticRoleNames.Tenants.Buyer);
        if (buyerRole != null)
        {
            GrantPermissionsIfNotExists(buyerRole, new[] { PermissionNames.Pages_PrimeShip });
        }

        var adminRole = roles.FirstOrDefault(r => r.Name == StaticRoleNames.Tenants.Admin);
        if (adminRole != null)
        {
            GrantPermissionsIfNotExists(adminRole, new[] {
                PermissionNames.Pages_Users,
                PermissionNames.Pages_Roles,
                PermissionNames.Pages_Categories,
                PermissionNames.Pages_Categories_Create,
                PermissionNames.Pages_Categories_Edit,
                PermissionNames.Pages_Categories_Delete,
                PermissionNames.Pages_Products,
                PermissionNames.Pages_Products_Create,
                PermissionNames.Pages_Products_Edit,
                PermissionNames.Pages_Products_Delete,
                PermissionNames.Pages_Stores,
                PermissionNames.Pages_Stores_Create,
                PermissionNames.Pages_Stores_Edit,
                PermissionNames.Pages_Stores_Delete,
                PermissionNames.Pages_StoreProducts,
                PermissionNames.Pages_StoreProducts_Create,
                PermissionNames.Pages_StoreProducts_Edit,
                PermissionNames.Pages_StoreProducts_Delete,
                PermissionNames.Pages_SmartStore,
                PermissionNames.Pages_SmartStore_Admin, // ✅ Added
                PermissionNames.Pages_PrimeShip,
                PermissionNames.Pages_PrimeShip_Admin,
                PermissionNames.Pages_GlobalPay,
                PermissionNames.Pages_GlobalPay_Admin,
                PermissionNames.Admin, // Legacy compatibility for old [AbpAuthorize("Admin")] checks
                "Stores" // ✅ Flat permission added for compatibility
            });
        }
    }

    private void GrantPermissionsIfNotExists(Role role, string[] permissionNames)
    {
        var existing = _context.Permissions
            .OfType<RolePermissionSetting>()
            .Where(p => p.TenantId == _tenantId && p.RoleId == role.Id)
            .Select(p => p.Name)
            .ToList();

        bool changed = false;
        foreach (var name in permissionNames)
        {
            if (!existing.Contains(name))
            {
                _context.Permissions.Add(new RolePermissionSetting
                {
                    TenantId = _tenantId,
                    Name = name,
                    IsGranted = true,
                    RoleId = role.Id
                });
                changed = true;
            }
        }

        if (changed)
        {
            _context.SaveChanges();
        }
    }

    private void CreateVerifiedPlatformUsers(PasswordHasher<User> passwordHasher)
    {
        if (_tenantId == 1) // Smart Store
        {
            CreateUser("admin@worldcartus.com", "SS_admin@worldcartus.com", StaticRoleNames.Tenants.Admin, passwordHasher); // ✅ Added
            CreateUser("noshahis@worldcartus.com", "SS_noshahis@worldcartus.com", StaticRoleNames.Tenants.Supplier, passwordHasher);
            CreateUser("noshahir@worldcartus.com", "SS_noshahir@worldcartus.com", StaticRoleNames.Tenants.Reseller, passwordHasher);
            CreateUser("noshahic@worldcartus.com", "SS_noshahic@worldcartus.com", StaticRoleNames.Tenants.Buyer, passwordHasher);
        }
        else if (_tenantId == 2) // Prime Ship
        {
            // Primary user noshahi@primeshipuk.com - Admin to manage categories
            CreateUser("noshahi@primeshipuk.com", "PS_noshahi@primeshipuk.com", StaticRoleNames.Tenants.Admin, passwordHasher);
            
            // Secondary Supplier/Reseller users
            CreateUser("noshahis@primeshipuk.com", "PS_noshahis@primeshipuk.com", StaticRoleNames.Tenants.Supplier, passwordHasher);
            CreateUser("admin@primeshipuk.com", "PS_admin@primeshipuk.com", StaticRoleNames.Tenants.Admin, passwordHasher);
        }
        else if (_tenantId == 3) // Easy Finora
        {
            CreateUser("noshahi@easyfinora.com", "GP_noshahi@easyfinora.com", StaticRoleNames.Tenants.Admin, passwordHasher);
            CreateUser("noshahi@finora.com", "GP_noshahi@finora.com", StaticRoleNames.Tenants.Admin, passwordHasher);
        }
    }

    private void CreateUser(string email, string userName, string roleName, PasswordHasher<User> passwordHasher)
    {
        var existingUser = _context.Users.IgnoreQueryFilters().FirstOrDefault(u => u.TenantId == _tenantId && u.UserName == userName);
        
        if (existingUser == null)
        {
            var user = new User
            {
                TenantId = _tenantId,
                UserName = userName,
                Name = "Noshahi",
                Surname = "Platform User",
                EmailAddress = email,
                IsEmailConfirmed = true,
                IsActive = true,
                PhoneNumber = "0000000000",
                Country = "United Kingdom"
            };

            user.SetNormalizedNames();
            user.Password = passwordHasher.HashPassword(user, "Noshahi.000");
            _context.Users.Add(user);
            _context.SaveChanges();
            existingUser = user;
        }
        else
        {
            // Ensure active and password is correct for these specific users
            existingUser.IsActive = true;
            existingUser.IsEmailConfirmed = true;
            existingUser.Password = passwordHasher.HashPassword(existingUser, "Noshahi.000");
            _context.Update(existingUser);
            _context.SaveChanges();
        }

        // Assign role
        var role = _context.Roles.IgnoreQueryFilters().FirstOrDefault(r => r.TenantId == _tenantId && r.Name == roleName);
        if (role != null)
        {
            var hasRole = _context.UserRoles.IgnoreQueryFilters().Any(ur => ur.UserId == existingUser.Id && ur.RoleId == role.Id);
            if (!hasRole)
            {
                _context.UserRoles.Add(new UserRole(_tenantId, existingUser.Id, role.Id));
                _context.SaveChanges();
            }
        }
    }
}
