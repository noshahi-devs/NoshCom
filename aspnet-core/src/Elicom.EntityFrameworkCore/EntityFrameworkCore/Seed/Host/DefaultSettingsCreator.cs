using Abp.Configuration;
using Abp.Localization;
using Abp.MultiTenancy;
using Abp.Net.Mail;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Elicom.EntityFrameworkCore.Seed.Host;

public class DefaultSettingsCreator
{
    private readonly ElicomDbContext _context;

    public DefaultSettingsCreator(ElicomDbContext context)
    {
        _context = context;
    }

    public void Create()
    {
        int? tenantId = null;

        if (ElicomConsts.MultiTenancyEnabled == false)
        {
            tenantId = MultiTenancyConsts.DefaultTenantId;
        }

        // Emailing
        // Emailing
        AddSettingIfNotExists(EmailSettingNames.DefaultFromAddress, "no-reply@primeshipuk.com", tenantId);
        AddSettingIfNotExists(EmailSettingNames.DefaultFromDisplayName, "Prime Ship UK", tenantId);
        AddSettingIfNotExists("Abp.Net.Mail.Smtp.Host", "primeshipuk.com", tenantId);
        AddSettingIfNotExists("Abp.Net.Mail.Smtp.Port", "465", tenantId);
        AddSettingIfNotExists("Abp.Net.Mail.Smtp.UserName", "no-reply@primeshipuk.com", tenantId);
        AddSettingIfNotExists("Abp.Net.Mail.Smtp.Password", "xB}Q]@saOI^K", tenantId);
        AddSettingIfNotExists("Abp.Net.Mail.Smtp.EnableSsl", "true", tenantId);
        AddSettingIfNotExists("Abp.Net.Mail.Smtp.UseDefaultCredentials", "false", tenantId);

        // Languages
        AddSettingIfNotExists(LocalizationSettingNames.DefaultLanguage, "en", tenantId);
    }

    private void AddSettingIfNotExists(string name, string value, int? tenantId = null)
    {
        if (_context.Settings.IgnoreQueryFilters().Any(s => s.Name == name && s.TenantId == tenantId && s.UserId == null))
        {
            return;
        }

        _context.Settings.Add(new Setting(tenantId, null, name, value));
        _context.SaveChanges();
    }
}
