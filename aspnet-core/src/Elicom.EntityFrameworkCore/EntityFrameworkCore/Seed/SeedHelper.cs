using Abp.Dependency;
using Abp.Domain.Uow;
using Abp.EntityFrameworkCore.Uow;
using Abp.MultiTenancy;
using Elicom.EntityFrameworkCore.Seed.Host;
using Elicom.EntityFrameworkCore.Seed.Tenants;
using Microsoft.EntityFrameworkCore;
using System;
using System.Transactions;
using System.Linq;

namespace Elicom.EntityFrameworkCore.Seed;

public static class SeedHelper
{
    public static void SeedHostDb(IIocResolver iocResolver)
    {
        int retryCount = 0;
        const int maxRetries = 3;
        while (retryCount < maxRetries)
        {
            try
            {
                WithDbContext<ElicomDbContext>(iocResolver, SeedHostDb);
                break; // Success!
            }
            catch (Exception ex)
            {
                retryCount++;
                Console.WriteLine($"[SEED-FATAL] Attempt {retryCount} failed: {ex.Message}");
                if (retryCount >= maxRetries)
                {
                    Console.WriteLine("[SEED-FATAL] Max retries reached. Primary startup will continue but DB might be inconsistent.");
                }
                else
                {
                    System.Threading.Thread.Sleep(2000 * retryCount); // Exponential backoff
                }
            }
        }
    }

    public static void SeedHostDb(ElicomDbContext context)
    {
        try
        {
            // Increase timeout for long-running migrations (recreating tables)
            context.Database.SetCommandTimeout(300);

            var connStr = context.Database.GetDbConnection().ConnectionString;
            var safeConnStr = string.Join(";", connStr.Split(';').Where(s => !s.Trim().StartsWith("Password", StringComparison.OrdinalIgnoreCase) && !s.Trim().StartsWith("Pwd", StringComparison.OrdinalIgnoreCase)));
            Console.WriteLine($"[SEED-DEBUG] Target DB: {safeConnStr}");

            var applied = context.Database.GetAppliedMigrations().ToList();
            Console.WriteLine($"[SEED-DEBUG] Applied Migrations ({applied.Count}): Last -> {applied.LastOrDefault()}");

            var pending = context.Database.GetPendingMigrations().ToList();
            Console.WriteLine($"[SEED-DEBUG] Pending Migrations ({pending.Count}): {string.Join(", ", pending)}");

            if (pending.Any())
            {
                Console.WriteLine("[SEED-DEBUG] Applying Migrations...");
                context.Database.Migrate();
                Console.WriteLine("[SEED-DEBUG] Migrations Applied Successfully.");
            }
            else
            {
                Console.WriteLine("[SEED-DEBUG] No Pending Migrations.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SEED-DEBUG] MIGRATION ERROR: {ex}");
            // We don't re-throw here to allow data seeding (if possible) or at least help debug
        }

        try 
        {
            context.SuppressAutoSetTenantId = true;

            // Host seed
            new InitialHostDbBuilder(context).Create();

            // Default tenant seed (in host database).
            new DefaultTenantBuilder(context).Create();
            new TenantRoleAndUserBuilder(context, 1).Create(); // Smart Store
            new TenantRoleAndUserBuilder(context, 2).Create(); // Prime Ship
            new TenantRoleAndUserBuilder(context, 3).Create(); // Easy Finora
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SEED-DEBUG] DATA SEEDING ERROR: {ex}");
            throw; // Re-throw to trigger the retry loop in the caller
        }
    }

    private static void WithDbContext<TDbContext>(IIocResolver iocResolver, Action<TDbContext> contextAction)
        where TDbContext : DbContext
    {
        using (var uowManager = iocResolver.ResolveAsDisposable<IUnitOfWorkManager>())
        {
            using (var uow = uowManager.Object.Begin(TransactionScopeOption.Suppress))
            {
                var context = uowManager.Object.Current.GetDbContext<TDbContext>(MultiTenancySides.Host);

                contextAction(context);

                uow.Complete();
            }
        }
    }
}
