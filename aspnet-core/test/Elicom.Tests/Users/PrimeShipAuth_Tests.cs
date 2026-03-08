using Elicom.Authorization.Accounts;
using Elicom.Authorization.Accounts.Dto;
using Elicom.Controllers;
using Elicom.Models.TokenAuth;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System.Threading.Tasks;
using Xunit;
using Elicom.Authorization.Users;
using System.Linq;
using Abp.Domain.Uow;
using Abp.Runtime.Session;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Abp.MultiTenancy;
using Elicom.Authorization;
using Elicom.Authentication.JwtBearer;
using Elicom.Authorization.Roles;

namespace Elicom.Tests.Users;

/// <summary>
/// Comprehensive tests for Prime Ship (Tenant 2) authentication flow
/// Tests registration, email verification, and login for both Sellers and Customers
/// </summary>
public class PrimeShipAuth_Tests : ElicomTestBase
{
    private readonly IAccountAppService _accountAppService;
    private readonly TokenAuthController _tokenAuthController;
    private readonly UserManager _userManager;

    public PrimeShipAuth_Tests()
    {
        _accountAppService = Resolve<IAccountAppService>();
        _userManager = Resolve<UserManager>();

        // Setup TokenAuthController for login tests
        var logInManager = Resolve<LogInManager>();
        var tenantCache = Resolve<ITenantCache>();
        var configuration = Resolve<TokenAuthConfiguration>();

        // Configure JWT for testing
        configuration.SecurityKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
            System.Text.Encoding.ASCII.GetBytes("ThisIsASecretKeyForTestingOnly123456"));
        configuration.Issuer = "Elicom";
        configuration.Audience = "Elicom";
        configuration.SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
            configuration.SecurityKey, 
            Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256);
        configuration.Expiration = System.TimeSpan.FromDays(1);

        _tokenAuthController = new TokenAuthController(
            logInManager,
            tenantCache,
            configuration,
            _userManager
        );

        _tokenAuthController.UnitOfWorkManager = Resolve<IUnitOfWorkManager>();
        _tokenAuthController.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    #region Seller Registration Tests

    [Fact]
    public async Task RegisterPrimeShipSeller_CreatesUserInTenant2()
    {
        // Arrange
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = "seller.test@primeship.com",
            Password = "SecurePass123!",
            PhoneNumber = "+44 7700 900123",
            Country = "United Kingdom"
        };

        // Act
        await _accountAppService.RegisterPrimeShipSeller(input);

        // Assert
        await UsingDbContextAsync(async context =>
        {
            var user = await context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.EmailAddress == input.EmailAddress && u.TenantId == 2);

            user.ShouldNotBeNull("Seller should be created in Tenant 2 (Prime Ship)");
            user.UserName.ShouldBe($"PS_{input.EmailAddress}", "Username should have PS_ prefix");
            user.PhoneNumber.ShouldBe(input.PhoneNumber);
            user.Country.ShouldBe(input.Country);
            user.IsActive.ShouldBeFalse("User should be inactive until email verification");
            user.IsEmailConfirmed.ShouldBeFalse("Email should not be confirmed yet");
        });
    }

    [Fact]
    public async Task RegisterPrimeShipSeller_AssignsSupplierRole()
    {
        // Arrange
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = "supplier.role@primeship.com",
            Password = "SecurePass123!",
            PhoneNumber = "+1 555 0100",
            Country = "United States"
        };

        // Act
        await _accountAppService.RegisterPrimeShipSeller(input);

        // Assert
        await UsingDbContextAsync(async context =>
        {
            var user = await context.Users
                .IgnoreQueryFilters()
                .Include(u => u.Roles)
                .FirstOrDefaultAsync(u => u.EmailAddress == input.EmailAddress && u.TenantId == 2);

            user.ShouldNotBeNull();
            
            var roles = await _userManager.GetRolesAsync(user);
            roles.ShouldContain(StaticRoleNames.Tenants.Supplier);
        });
    }

    #endregion

    #region Customer Registration Tests

    [Fact]
    public async Task RegisterPrimeShipCustomer_CreatesUserInTenant2()
    {
        // Arrange
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = "customer.test@primeship.com",
            Password = "SecurePass123!",
            PhoneNumber = "+61 2 1234 5678",
            Country = "Australia"
        };

        // Act
        await _accountAppService.RegisterPrimeShipCustomer(input);

        // Assert
        await UsingDbContextAsync(async context =>
        {
            var user = await context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.EmailAddress == input.EmailAddress && u.TenantId == 2);

            user.ShouldNotBeNull("Customer should be created in Tenant 2 (Prime Ship)");
            user.UserName.ShouldBe($"PS_{input.EmailAddress}", "Username should have PS_ prefix");
            user.IsActive.ShouldBeFalse("User should be inactive until email verification");
        });
    }

    [Fact]
    public async Task RegisterPrimeShipCustomer_AssignsResellerRole()
    {
        // Arrange
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = "reseller.role@primeship.com",
            Password = "SecurePass123!",
            PhoneNumber = "+49 30 12345678",
            Country = "Germany"
        };

        // Act
        await _accountAppService.RegisterPrimeShipCustomer(input);

        // Assert
        await UsingDbContextAsync(async context =>
        {
            var user = await context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.EmailAddress == input.EmailAddress && u.TenantId == 2);

            user.ShouldNotBeNull();
            
            var roles = await _userManager.GetRolesAsync(user);
            roles.ShouldContain(StaticRoleNames.Tenants.Reseller);
        });
    }

    #endregion

    #region Email Verification Tests

    [Fact]
    public async Task VerifyEmail_ActivatesUserAndConfirmsEmail()
    {
        // Arrange - Register a new seller
        var email = "verify.seller@primeship.com";
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = email,
            Password = "SecurePass123!",
            PhoneNumber = "+1 555 0200",
            Country = "Canada"
        };

        await _accountAppService.RegisterPrimeShipSeller(input);

        // Get user and generate token
        User user = null;
        string token = null;
        await UsingDbContextAsync(null, async context =>
        {
            user = await context.Users
                .IgnoreQueryFilters()
                .FirstAsync(u => u.EmailAddress == email && u.TenantId == 2);
            token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        });

        // Act - Verify email (simulating click on verification link)
        AbpSession.TenantId = null; // Simulate anonymous request
        ContentResult result;
        using (var uow = LocalIocManager.Resolve<IUnitOfWorkManager>().Begin())
        {
            result = await _accountAppService.VerifyEmail(user.Id, token, "Prime Ship");
            await uow.CompleteAsync();
        }

        // Assert
        result.ShouldNotBeNull();
        result.Content.ShouldContain("Prime Ship Account Verified!");
        result.Content.ShouldContain("/primeship/login");

        await UsingDbContextAsync(async context =>
        {
            var verifiedUser = await context.Users
                .IgnoreQueryFilters()
                .FirstAsync(u => u.Id == user.Id);
            
            verifiedUser.IsEmailConfirmed.ShouldBeTrue("Email should be confirmed");
            verifiedUser.IsActive.ShouldBeTrue("User should be activated");
        });
    }

    [Fact]
    public async Task VerifyEmail_WithInvalidToken_ThrowsError()
    {
        // Arrange
        var email = "invalid.token@primeship.com";
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = email,
            Password = "SecurePass123!",
            PhoneNumber = "+1 555 0300",
            Country = "United States"
        };

        await _accountAppService.RegisterPrimeShipSeller(input);

        User user = null;
        await UsingDbContextAsync(null, async context =>
        {
            user = await context.Users
                .IgnoreQueryFilters()
                .FirstAsync(u => u.EmailAddress == email && u.TenantId == 2);
        });

        // Act & Assert
        AbpSession.TenantId = null;
        using (var uow = LocalIocManager.Resolve<IUnitOfWorkManager>().Begin())
        {
            await Should.ThrowAsync<Abp.UI.UserFriendlyException>(async () =>
            {
                await _accountAppService.VerifyEmail(user.Id, "INVALID_TOKEN", "Prime Ship");
            });
        }
    }

    #endregion

    #region Login Tests

    [Fact]
    public async Task Login_WithVerifiedAccount_ReturnsToken()
    {
        // Arrange - Register and verify a seller
        var email = "login.seller@primeship.com";
        var password = "SecurePass123!";
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = email,
            Password = password,
            PhoneNumber = "+1 555 0400",
            Country = "United States"
        };

        await _accountAppService.RegisterPrimeShipSeller(input);

        // Verify the account
        User user = null;
        string token = null;
        await UsingDbContextAsync(null, async context =>
        {
            user = await context.Users
                .IgnoreQueryFilters()
                .FirstAsync(u => u.EmailAddress == email && u.TenantId == 2);
            token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        });

        AbpSession.TenantId = null;
        using (var uow = LocalIocManager.Resolve<IUnitOfWorkManager>().Begin())
        {
            await _accountAppService.VerifyEmail(user.Id, token, "Prime Ship");
            await uow.CompleteAsync();
        }

        // Act - Login with Tenant ID header
        _tokenAuthController.Request.Headers["Abp-TenantId"] = "2";
        
        var loginInput = new AuthenticateModel
        {
            UserNameOrEmailAddress = email,
            Password = password,
            RememberClient = true
        };

        AuthenticateResultModel result;
        using (var uow = Resolve<IUnitOfWorkManager>().Begin())
        {
            result = await _tokenAuthController.Authenticate(loginInput);
            await uow.CompleteAsync();
        }

        // Assert
        result.ShouldNotBeNull();
        result.AccessToken.ShouldNotBeNullOrEmpty("Should return JWT access token");
        result.UserId.ShouldBeGreaterThan(0);
        result.ExpireInSeconds.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task Login_WithUnverifiedAccount_ThrowsError()
    {
        // Arrange - Register but don't verify
        var email = "unverified.seller@primeship.com";
        var password = "SecurePass123!";
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = email,
            Password = password,
            PhoneNumber = "+1 555 0500",
            Country = "United States"
        };

        await _accountAppService.RegisterPrimeShipSeller(input);

        // Act & Assert - Try to login without verification
        _tokenAuthController.Request.Headers["Abp-TenantId"] = "2";
        
        var loginInput = new AuthenticateModel
        {
            UserNameOrEmailAddress = email,
            Password = password
        };

        using (var uow = Resolve<IUnitOfWorkManager>().Begin())
        {
            var exception = await Should.ThrowAsync<Abp.UI.UserFriendlyException>(async () =>
            {
                await _tokenAuthController.Authenticate(loginInput);
            });

            exception.Message.ShouldContain("email is not confirmed");
        }
    }

    [Fact]
    public async Task Login_GlobalDiscovery_FindsUserInTenant2()
    {
        // Arrange - Register and verify
        var email = "global.discovery@primeship.com";
        var password = "SecurePass123!";
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = email,
            Password = password,
            PhoneNumber = "+1 555 0600",
            Country = "United States"
        };

        await _accountAppService.RegisterPrimeShipSeller(input);

        // Verify
        User user = null;
        string token = null;
        await UsingDbContextAsync(null, async context =>
        {
            user = await context.Users
                .IgnoreQueryFilters()
                .FirstAsync(u => u.EmailAddress == email && u.TenantId == 2);
            token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        });

        AbpSession.TenantId = null;
        using (var uow = LocalIocManager.Resolve<IUnitOfWorkManager>().Begin())
        {
            await _accountAppService.VerifyEmail(user.Id, token, "Prime Ship");
            await uow.CompleteAsync();
        }

        // Act - Login WITHOUT tenant header (global discovery)
        var loginInput = new AuthenticateModel
        {
            UserNameOrEmailAddress = email,
            Password = password
        };

        AuthenticateResultModel result;
        using (var uow = Resolve<IUnitOfWorkManager>().Begin())
        {
            result = await _tokenAuthController.Authenticate(loginInput);
            await uow.CompleteAsync();
        }

        // Assert
        result.ShouldNotBeNull("Global discovery should find user in Tenant 2");
        result.AccessToken.ShouldNotBeNullOrEmpty();
    }

    [Fact]
    public async Task Login_WithWrongPassword_ThrowsError()
    {
        // Arrange
        var email = "wrong.password@primeship.com";
        var password = "SecurePass123!";
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = email,
            Password = password,
            PhoneNumber = "+1 555 0700",
            Country = "United States"
        };

        await _accountAppService.RegisterPrimeShipSeller(input);

        // Verify
        User user = null;
        string token = null;
        await UsingDbContextAsync(null, async context =>
        {
            user = await context.Users
                .IgnoreQueryFilters()
                .FirstAsync(u => u.EmailAddress == email && u.TenantId == 2);
            token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        });

        AbpSession.TenantId = null;
        using (var uow = LocalIocManager.Resolve<IUnitOfWorkManager>().Begin())
        {
            await _accountAppService.VerifyEmail(user.Id, token, "Prime Ship");
            await uow.CompleteAsync();
        }

        // Act & Assert
        _tokenAuthController.Request.Headers["Abp-TenantId"] = "2";
        
        var loginInput = new AuthenticateModel
        {
            UserNameOrEmailAddress = email,
            Password = "WrongPassword123!"
        };

        using (var uow = Resolve<IUnitOfWorkManager>().Begin())
        {
            var exception = await Should.ThrowAsync<Abp.UI.UserFriendlyException>(async () =>
            {
                await _tokenAuthController.Authenticate(loginInput);
            });

            exception.Message.ShouldContain("Invalid password");
        }
    }

    #endregion

    #region Duplicate Registration Tests

    [Fact]
    public async Task RegisterPrimeShipSeller_WithExistingEmail_ResendsVerification()
    {
        // Arrange
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = "duplicate.seller@primeship.com",
            Password = "SecurePass123!",
            PhoneNumber = "+1 555 0800",
            Country = "United States"
        };

        // Act - Register twice
        await _accountAppService.RegisterPrimeShipSeller(input);
        await _accountAppService.RegisterPrimeShipSeller(input); // Should not throw

        // Assert
        await UsingDbContextAsync(async context =>
        {
            var users = await context.Users
                .IgnoreQueryFilters()
                .Where(u => u.EmailAddress == input.EmailAddress && u.TenantId == 2)
                .ToListAsync();

            users.Count.ShouldBe(1, "Should not create duplicate users");
        });
    }

    #endregion
}
