using System;
using System.Linq;
using Abp.Authorization.Users;
using Elicom.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Elicom.Authorization.Users;
using Elicom.Authorization.Roles;
using Elicom.Authorization;

namespace Elicom.Migrator;

/// <summary>
/// Simple seeder to add admin@primeshipuk.com for Prime Ship (Tenant 2)
/// </summary>
public class PrimeShipAdminSeeder
{
    public static void SeedAdmin()
    {
        var connectionString = "Server=localhost;Database=ElicomDb;Trusted_Connection=True;TrustServerCertificate=True";
        
        var optionsBuilder = new DbContextOptionsBuilder<ElicomDbContext>();
        optionsBuilder.UseSqlServer(connectionString);

        using var context = new ElicomDbContext(optionsBuilder.Options);
        
        const int tenantId = 2; // Prime Ship
        const string adminEmail = "admin@primeshipuk.com";
        const string adminUserName = "PS_admin@primeshipuk.com";
        const string password = "Noshahi.000";

        Console.WriteLine("========================================");
        Console.WriteLine("PRIME SHIP ADMIN SEEDER");
        Console.WriteLine("========================================");
        Console.WriteLine($"Tenant ID: {tenantId}");
        Console.WriteLine($"Email: {adminEmail}");
        Console.WriteLine($"Username: {adminUserName}");
        Console.WriteLine();

        // Get Admin role
        var adminRole = context.Roles
            .IgnoreQueryFilters()
            .FirstOrDefault(r => r.TenantId == tenantId && r.Name == StaticRoleNames.Tenants.Admin);

        if (adminRole == null)
        {
            Console.WriteLine("❌ Admin role not found for Tenant 2!");
            Console.WriteLine("Please run the main migrator first to create roles.");
            return;
        }

        Console.WriteLine($"✅ Found Admin role (ID: {adminRole.Id})");

        // Check if user exists
        var existingUser = context.Users
            .IgnoreQueryFilters()
            .FirstOrDefault(u => u.TenantId == tenantId && u.EmailAddress == adminEmail);

        User adminUser;
        var passwordHasher = new PasswordHasher<User>(new OptionsWrapper<PasswordHasherOptions>(new PasswordHasherOptions()));

        if (existingUser != null)
        {
            Console.WriteLine($"⚠️  User already exists (ID: {existingUser.Id})");
            Console.WriteLine("Updating password and status...");
            
            existingUser.Password = passwordHasher.HashPassword(existingUser, password);
            existingUser.IsEmailConfirmed = true;
            existingUser.IsActive = true;
            
            context.Users.Update(existingUser);
            context.SaveChanges();
            
            adminUser = existingUser;
            Console.WriteLine("✅ Updated existing user");
        }
        else
        {
            Console.WriteLine("Creating new admin user...");
            
            adminUser = new User
            {
                TenantId = tenantId,
                UserName = adminUserName,
                Name = "Admin",
                Surname = "User",
                EmailAddress = adminEmail,
                IsEmailConfirmed = true,
                IsActive = true,
                PhoneNumber = "+923001234567",
                Country = "UK"
            };

            adminUser.SetNormalizedNames();
            adminUser.Password = passwordHasher.HashPassword(adminUser, password);
            
            context.Users.Add(adminUser);
            context.SaveChanges();
            
            Console.WriteLine($"✅ Created new user (ID: {adminUser.Id})");
        }

        // Assign Admin role
        var userRole = context.UserRoles
            .IgnoreQueryFilters()
            .FirstOrDefault(ur => ur.UserId == adminUser.Id && ur.RoleId == adminRole.Id);

        if (userRole == null)
        {
            Console.WriteLine("Assigning Admin role...");
            
            context.UserRoles.Add(new UserRole(tenantId, adminUser.Id, adminRole.Id));
            context.SaveChanges();
            
            Console.WriteLine("✅ Assigned Admin role");
        }
        else
        {
            Console.WriteLine("✅ User already has Admin role");
        }

        // Verify
        Console.WriteLine();
        Console.WriteLine("========================================");
        Console.WriteLine("VERIFICATION:");
        Console.WriteLine("========================================");

        var verification = context.Users
            .IgnoreQueryFilters()
            .Where(u => u.Id == adminUser.Id)
            .Select(u => new
            {
                u.EmailAddress,
                u.UserName,
                u.IsActive,
                u.IsEmailConfirmed,
                Roles = context.UserRoles
                    .IgnoreQueryFilters()
                    .Where(ur => ur.UserId == u.Id)
                    .Join(context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
                    .ToList()
            })
            .FirstOrDefault();

        if (verification != null)
        {
            Console.WriteLine($"Email: {verification.EmailAddress}");
            Console.WriteLine($"Username: {verification.UserName}");
            Console.WriteLine($"Active: {verification.IsActive}");
            Console.WriteLine($"Email Confirmed: {verification.IsEmailConfirmed}");
            Console.WriteLine($"Roles: {string.Join(", ", verification.Roles)}");
        }

        Console.WriteLine();
        Console.WriteLine("========================================");
        Console.WriteLine("✅ SUCCESS!");
        Console.WriteLine("========================================");
        Console.WriteLine();
        Console.WriteLine("Login credentials:");
        Console.WriteLine($"  Email: {adminEmail}");
        Console.WriteLine($"  Password: {password}");
        Console.WriteLine();
        Console.WriteLine("URL: http://localhost:4300/auth/login");
        Console.WriteLine();
        Console.WriteLine("Next steps:");
        Console.WriteLine("1. Restart the backend (if running)");
        Console.WriteLine("2. Login with the credentials above");
        Console.WriteLine("3. Try creating a category");
        Console.WriteLine();
    }
}
