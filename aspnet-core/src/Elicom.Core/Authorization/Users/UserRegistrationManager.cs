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
            WalletId = GenerateWalletId(),
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

    private string GenerateWalletId()
    {
        var random = new Random();
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var randomPart = new string(Enumerable.Repeat(chars, 10)
            .Select(s => s[random.Next(s.Length)]).ToArray());
        return $"EF-{randomPart}";
    }

    protected virtual void CheckErrors(IdentityResult identityResult)
    {
        identityResult.CheckErrors(LocalizationManager);
    }
}
