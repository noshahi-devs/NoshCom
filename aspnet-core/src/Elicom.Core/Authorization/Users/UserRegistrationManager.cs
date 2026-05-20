using Abp.Authorization.Users;
using Abp.Domain.Services;
using Abp.IdentityFramework;
using Abp.Runtime.Session;
using Abp.UI;
using Elicom.Authorization.Roles;
using Elicom.Entities;
using Abp.Domain.Repositories;
using Elicom.MultiTenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Authorization.Users;

public class UserRegistrationManager : DomainService
{
    public IAbpSession AbpSession { get; set; }

    private readonly TenantManager _tenantManager;
    private readonly UserManager _userManager;
    private readonly RoleManager _roleManager;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly IRepository<Wallet, Guid> _walletRepository;

    public UserRegistrationManager(
        TenantManager tenantManager,
        UserManager userManager,
        RoleManager roleManager,
        IPasswordHasher<User> passwordHasher,
        IRepository<Wallet, Guid> walletRepository)
    {
        _tenantManager = tenantManager;
        _userManager = userManager;
        _roleManager = roleManager;
        _passwordHasher = passwordHasher;
        _walletRepository = walletRepository;

        AbpSession = NullAbpSession.Instance;
    }

    public async Task<User> RegisterAsync(string name, string surname, string emailAddress, string userName, string plainPassword, bool isEmailConfirmed, string phoneNumber = null, string country = null)
    {
        CheckForTenant();

        var tenant = await GetActiveTenantAsync();

        var user = new User
        {
            TenantId = tenant.Id,
            Name = name,
            Surname = surname,
            EmailAddress = emailAddress,
            IsActive = false,
            UserName = userName,
            IsEmailConfirmed = isEmailConfirmed,
            PhoneNumber = phoneNumber,
            Country = country,
            WalletId = await GenerateWalletIdAsync(),
            Roles = new List<UserRole>()
        };

        user.SetNormalizedNames();

        foreach (var defaultRole in await _roleManager.Roles.Where(r => r.IsDefault).ToListAsync())
        {
            user.Roles.Add(new UserRole(tenant.Id, user.Id, defaultRole.Id));
        }

        await _userManager.InitializeOptionsAsync(tenant.Id);

        CheckErrors(await _userManager.CreateAsync(user, plainPassword));
        await CurrentUnitOfWork.SaveChangesAsync();

        // Create Wallet for the user
        await _walletRepository.InsertAsync(new Wallet
        {
            UserId = user.Id,
            Balance = 0,
            Currency = "PKR"
        });

        if (tenant.Id == 2)
        {
            // Switch tenant to 3 to register the user in EasyFinora as well
            using (CurrentUnitOfWork.SetTenantId(3))
            {
                var easyFinoraUser = new User
                {
                    TenantId = 3,
                    Name = name,
                    Surname = surname,
                    EmailAddress = emailAddress,
                    IsActive = true, // Force active/confirmed for seamless multi-platform access
                    UserName = userName,
                    IsEmailConfirmed = true,
                    PhoneNumber = phoneNumber,
                    Country = country,
                    WalletId = user.WalletId, // Share the exact same Wallet ID
                    Roles = new List<UserRole>()
                };

                easyFinoraUser.SetNormalizedNames();

                // Assign default roles in Tenant 3
                foreach (var defaultRole in await _roleManager.Roles.Where(r => r.IsDefault).ToListAsync())
                {
                    easyFinoraUser.Roles.Add(new UserRole(3, easyFinoraUser.Id, defaultRole.Id));
                }

                await _userManager.InitializeOptionsAsync(3);
                CheckErrors(await _userManager.CreateAsync(easyFinoraUser, plainPassword));
                await CurrentUnitOfWork.SaveChangesAsync();

                // Create Wallet for the user in Tenant 3
                await _walletRepository.InsertAsync(new Wallet
                {
                    UserId = easyFinoraUser.Id,
                    Balance = 0,
                    Currency = "PKR"
                });
            }
        }

        return user;
    }

    private void CheckForTenant()
    {
        // Default to Tenant 1 if no tenant is provided, instead of throwing.
        if (!AbpSession.TenantId.HasValue && !CurrentUnitOfWork.GetTenantId().HasValue)
        {
            // We can optionally set it in the UOW here if needed, but the RegisterAsync logic 
            // will now use 1 as a fallback via GetActiveTenantAsync.
            return;
        }
    }

    private async Task<Tenant> GetActiveTenantAsync()
    {
        var tenantId = CurrentUnitOfWork.GetTenantId() ?? AbpSession.TenantId ?? 1;
        
        return await GetActiveTenantAsync(tenantId);
    }

    private async Task<Tenant> GetActiveTenantAsync(int tenantId)
    {
        var tenant = await _tenantManager.FindByIdAsync(tenantId);
        if (tenant == null)
        {
            throw new UserFriendlyException(L("UnknownTenantId{0}", tenantId));
        }

        if (!tenant.IsActive)
        {
            throw new UserFriendlyException(L("TenantIdIsNotActive{0}", tenantId));
        }

        return tenant;
    }

    private async Task<string> GenerateWalletIdAsync()
    {
        using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
        {
            var gmUserWalletIds = await _userManager.Users
                .Where(u => u.WalletId != null && u.WalletId.StartsWith("GM-15UK"))
                .Select(u => u.WalletId)
                .ToListAsync();

            long nextNum = 4255;
            if (gmUserWalletIds.Any())
            {
                var maxNum = gmUserWalletIds
                    .Select(id => id.Substring(7))
                    .Select(numStr => long.TryParse(numStr, out var val) ? val : 0)
                    .Max();
                nextNum = Math.Max(4255, maxNum + 1);
            }

            return $"GM-15UK{nextNum}";
        }
    }

    protected virtual void CheckErrors(IdentityResult identityResult)
    {
        identityResult.CheckErrors(LocalizationManager);
    }
}
