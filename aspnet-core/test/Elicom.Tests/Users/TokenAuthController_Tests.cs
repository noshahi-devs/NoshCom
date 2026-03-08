using System.Threading.Tasks;
using Elicom.Controllers;
using Elicom.Models.TokenAuth;
using Shouldly;
using Xunit;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using Microsoft.Extensions.Primitives;
using Abp.Runtime.Session;
using Elicom.Authorization;
using Abp.MultiTenancy;
using Elicom.Authentication.JwtBearer;
using Elicom.Authorization.Users;

namespace Elicom.Tests.Users;

public class TokenAuthController_Tests : ElicomTestBase
{
    private readonly TokenAuthController _controller;

    public TokenAuthController_Tests()
    {
        // Resolve dependencies
        var logInManager = Resolve<LogInManager>();
        var tenantCache = Resolve<ITenantCache>();
        var configuration = Resolve<TokenAuthConfiguration>();
        var userManager = Resolve<UserManager>();

        // Manually configure TokenAuth for testing
        configuration.SecurityKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.ASCII.GetBytes("ThisIsASecretKeyForTestingOnly123456"));
        configuration.Issuer = "Elicom";
        configuration.Audience = "Elicom";
        configuration.SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(configuration.SecurityKey, Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256);
        configuration.Expiration = System.TimeSpan.FromDays(1);

        _controller = new TokenAuthController(
            logInManager,
            tenantCache,
            configuration,
            userManager
        );

        _controller.UnitOfWorkManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();

        // Mock HttpContext for Headers access
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    [Fact]
    public async Task Authenticate_GlobalDiscovery_Test()
    {
        // Arrange
        var input = new AuthenticateModel
        {
            UserNameOrEmailAddress = "noshahi@easyfinora.com",
            Password = "Noshahi.000"
        };

        // Act & Assert
        using (var uow = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>().Begin())
        {
            var result = await _controller.Authenticate(input);

            result.ShouldNotBeNull();
            result.AccessToken.ShouldNotBeNullOrEmpty();
            result.UserId.ShouldBeGreaterThan(0);
            
            await uow.CompleteAsync();
        }
    }

    [Fact]
    public async Task Authenticate_PrefixedUsername_Test()
    {
        // Arrange
        _controller.Request.Headers["Abp-TenantId"] = "3";
        
        var input = new AuthenticateModel
        {
            UserNameOrEmailAddress = "noshahi@easyfinora.com",
            Password = "Noshahi.000"
        };

        // Act & Assert
        using (var uow = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>().Begin())
        {
            var result = await _controller.Authenticate(input);

            result.ShouldNotBeNull();
            result.AccessToken.ShouldNotBeNullOrEmpty();
            
            await uow.CompleteAsync();
        }
    }
}
