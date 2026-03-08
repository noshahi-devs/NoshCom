using Elicom.Controllers;
using Elicom.Models.TokenAuth;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System.Threading.Tasks;
using Xunit;
using Elicom.Authorization.Users;
using Abp.Domain.Uow;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Abp.MultiTenancy;
using Elicom.Authorization;
using Elicom.Authentication.JwtBearer;

namespace Elicom.Tests.Users;

/// <summary>
/// Real user login test for Prime Ship
/// Tests login with actual user account: engr.adeelnoshahi@gmail.com
/// </summary>
public class PrimeShipRealUserLogin_Tests : ElicomTestBase
{
    private readonly TokenAuthController _tokenAuthController;
    private readonly UserManager _userManager;

    public PrimeShipRealUserLogin_Tests()
    {
        _userManager = Resolve<UserManager>();

        // Setup TokenAuthController
        var logInManager = Resolve<LogInManager>();
        var tenantCache = Resolve<ITenantCache>();
        var configuration = Resolve<TokenAuthConfiguration>();

        // Configure JWT
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

    [Fact]
    public async Task Login_RealUser_EngAdeelNoshahi_ShouldSucceed()
    {
        // Arrange
        var email = "engr.adeelnoshahi@gmail.com";
        var password = "Noshahi.000";

        // First, verify the user exists in Tenant 2
        await UsingDbContextAsync(async context =>
        {
            var user = await context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.EmailAddress == email && u.TenantId == 2);

            user.ShouldNotBeNull($"User {email} should exist in Tenant 2 (Prime Ship)");
            user.IsActive.ShouldBeTrue("User should be active");
            user.IsEmailConfirmed.ShouldBeTrue("User email should be confirmed");
        });

        // Act - Login with Tenant 2 header
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
        result.ShouldNotBeNull("Login should return a result");
        result.AccessToken.ShouldNotBeNullOrEmpty("Should return JWT access token");
        result.UserId.ShouldBeGreaterThan(0, "Should return valid user ID");
        result.ExpireInSeconds.ShouldBeGreaterThan(0, "Token should have expiration time");
        result.EncryptedAccessToken.ShouldNotBeNullOrEmpty("Should return encrypted token");
    }

    [Fact]
    public async Task Login_RealUser_GlobalDiscovery_ShouldSucceed()
    {
        // Arrange
        var email = "engr.adeelnoshahi@gmail.com";
        var password = "Noshahi.000";

        // Act - Login WITHOUT tenant header (global discovery should find user)
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
        result.ShouldNotBeNull("Global discovery should find user and login");
        result.AccessToken.ShouldNotBeNullOrEmpty();
        result.UserId.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task Login_RealUser_VerifyUserDetails()
    {
        // Arrange
        var email = "engr.adeelnoshahi@gmail.com";

        // Act & Assert
        await UsingDbContextAsync(async context =>
        {
            var user = await context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.EmailAddress == email && u.TenantId == 2);

            user.ShouldNotBeNull();

            // Assertions
            user.TenantId.ShouldBe(2, "User should be in Tenant 2 (Prime Ship)");
            user.UserName.ShouldStartWith("PS_");
            user.IsActive.ShouldBeTrue("User should be active");
            user.IsEmailConfirmed.ShouldBeTrue("Email should be confirmed");
        });
    }

    [Fact]
    public async Task Login_RealUser_WithWrongPassword_ShouldFail()
    {
        // Arrange
        var email = "engr.adeelnoshahi@gmail.com";
        var wrongPassword = "WrongPassword123!";

        _tokenAuthController.Request.Headers["Abp-TenantId"] = "2";

        var loginInput = new AuthenticateModel
        {
            UserNameOrEmailAddress = email,
            Password = wrongPassword
        };

        // Act & Assert
        using (var uow = Resolve<IUnitOfWorkManager>().Begin())
        {
            var exception = await Should.ThrowAsync<Abp.UI.UserFriendlyException>(async () =>
            {
                await _tokenAuthController.Authenticate(loginInput);
            });

            exception.Message.ShouldContain("Invalid password");
        }
    }
}
