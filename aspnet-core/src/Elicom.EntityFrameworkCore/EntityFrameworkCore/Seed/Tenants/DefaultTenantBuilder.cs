using Abp.MultiTenancy;
using Elicom.Editions;
using Elicom.MultiTenancy;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Elicom.EntityFrameworkCore.Seed.Tenants;

public class DefaultTenantBuilder
{
    private readonly ElicomDbContext _context;

    public DefaultTenantBuilder(ElicomDbContext context)
    {
        _context = context;
    }

    public void Create()
    {
        CreateDefaultTenant();
    }

    private void CreateDefaultTenant()
    {
        // 1. Default Tenant (Smart Store)
        var defaultTenant = _context.Tenants.IgnoreQueryFilters().FirstOrDefault(t => t.Id == 1 || t.TenancyName == AbpTenantBase.DefaultTenantName);
        if (defaultTenant == null)
        {
            defaultTenant = new Tenant(AbpTenantBase.DefaultTenantName, AbpTenantBase.DefaultTenantName) { Id = 1 };
            SeedTenant(defaultTenant);
        }

        // 2. Prime Ship Tenant
        var primeShipTenant = _context.Tenants.IgnoreQueryFilters().FirstOrDefault(t => t.Id == 2 || t.TenancyName == "primeship");
        if (primeShipTenant == null)
        {
            primeShipTenant = new Tenant("primeship", "Prime Ship") { Id = 2 };
            SeedTenant(primeShipTenant);
        }

        // 3. Easy Finora Tenant
        var easyFinoraTenant = _context.Tenants.IgnoreQueryFilters().FirstOrDefault(t => t.Id == 3 || t.TenancyName == "easyfinora" || t.TenancyName == "globalpay");
        if (easyFinoraTenant == null)
        {
            easyFinoraTenant = new Tenant("easyfinora", "Easy Finora") { Id = 3 };
            SeedTenant(easyFinoraTenant);
        }
    }

    private void SeedTenant(Tenant tenant)
    {
        var defaultEdition = _context.Editions.IgnoreQueryFilters().FirstOrDefault(e => e.Name == EditionManager.DefaultEditionName);
        if (defaultEdition != null)
        {
            tenant.EditionId = defaultEdition.Id;
        }

        _context.Tenants.Add(tenant);
        
        if (_context.Database.IsSqlServer())
        {
            _context.Database.OpenConnection();
            try
            {
                _context.Database.ExecuteSqlRaw("SET IDENTITY_INSERT AbpTenants ON");
                _context.SaveChanges();
                _context.Database.ExecuteSqlRaw("SET IDENTITY_INSERT AbpTenants OFF");
            }
            finally
            {
                _context.Database.CloseConnection();
            }
        }
        else
        {
            _context.SaveChanges();
        }
    }
}
