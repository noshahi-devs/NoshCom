using Elicom.Authorization.Accounts;
using Elicom.Authorization.Accounts.Dto;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Threading.Tasks;
using Xunit;
using Elicom.Authorization.Users;
using System.Linq;
using Abp.Domain.Uow;
using Abp.Runtime.Session;
using Microsoft.AspNetCore.Mvc;
using Abp.BackgroundJobs;
using Castle.MicroKernel.Registration;
using NSubstitute;
using Elicom.BackgroundJobs;

namespace Elicom.Tests.Users;

public class AccountAppService_Tests : ElicomTestBase
{
    private readonly IAccountAppService _accountAppService;
    private readonly IBackgroundJobManager _backgroundJobManager;

    public AccountAppService_Tests()
    {
        _backgroundJobManager = Substitute.For<IBackgroundJobManager>();
        LocalIocManager.IocContainer.Register(
            Component.For<IBackgroundJobManager>()
                .Instance(_backgroundJobManager)
                .LifestyleSingleton()
                .IsDefault()
        );

        _accountAppService = Resolve<IAccountAppService>();
    }

    [Fact]
    public async Task RegisterGlobalPayUser_Test()
    {
        // Arrange
        var input = new RegisterGlobalPayInput
        {
            EmailAddress = "testuser@easyfinora.com",
            FullName = "Test User",
            Password = "TestPassword123!",
            PhoneNumber = "1234567890",
            Country = "United Kingdom"
        };

        // Act
        await _accountAppService.RegisterGlobalPayUser(input);

        // Assert
        await UsingDbContextAsync(async context =>
        {
            // Verify user in Tenant 3
            var user = await context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.EmailAddress == input.EmailAddress && u.TenantId == 3);

            user.ShouldNotBeNull($"User {input.EmailAddress} not found in Tenant 3.");
            user.PhoneNumber.ShouldBe(input.PhoneNumber);
            user.Country.ShouldBe(input.Country);
            user.IsActive.ShouldBeFalse();
            user.IsEmailConfirmed.ShouldBeFalse();

            // Verify wallet
            var wallet = await context.Wallets.FirstOrDefaultAsync(w => w.UserId == user.Id);
            wallet.ShouldNotBeNull();
            wallet.Balance.ShouldBe(0);
        });
    }

    [Fact]
    public async Task VerifyEmail_Test()
    {
        // Arrange
        string email = "verifytest@easyfinora.com";
        var input = new RegisterGlobalPayInput
        {
            EmailAddress = email,
            FullName = "Verify User",
            Password = "TestPassword123!",
            PhoneNumber = "1234567890",
            Country = "United Kingdom"
        };

        await _accountAppService.RegisterGlobalPayUser(input);

        // 2. Get user and token
        User user = null;
        string token = null;
        await UsingDbContextAsync(null, async context => 
        {
            user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.EmailAddress == email && u.TenantId == 3);
            token = await Resolve<UserManager>().GenerateEmailConfirmationTokenAsync(user);
        });

        // 3. Act - Verify email (simulating anonymous call from Host context)
        AbpSession.TenantId = null; 
        ContentResult result;
        using (var uow = LocalIocManager.Resolve<IUnitOfWorkManager>().Begin())
        {
            result = await _accountAppService.VerifyEmail(user.Id, token, "Easy Finora");
            await uow.CompleteAsync();
        }

        // 4. Assert
        result.ShouldNotBeNull();
        result.Content.ShouldContain("Your account has been successfully verified!");
        result.Content.ShouldContain("Redirecting to login...");

        await _backgroundJobManager.Received(1).EnqueueAsync<PlatformEmailJob, PlatformEmailJobArgs>(
            Arg.Is<PlatformEmailJobArgs>(args =>
                args != null &&
                args.To == email &&
                args.Subject.Contains("Account is Verified") &&
                args.HtmlBody.Contains("Your Account is Verified!") &&
                args.HtmlBody.Contains("All rights reserved.")),
            Arg.Any<BackgroundJobPriority>(),
            Arg.Any<TimeSpan?>());

        await UsingDbContextAsync(async context =>
        {
            var verifiedUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == user.Id);
            verifiedUser.IsEmailConfirmed.ShouldBeTrue();
            verifiedUser.IsActive.ShouldBeTrue();
        });
    }

    [Fact]
    public async Task RegisterSmartStoreSeller_Test()
    {
        // Arrange
        var input = new RegisterSmartStoreInput
        {
            EmailAddress = "seller@smartstore.com",
            FullName = "Store Seller",
            Password = "TestPassword123!",
            PhoneNumber = "0987654321",
            Country = "USA"
        };

        // Act
        await _accountAppService.RegisterSmartStoreSeller(input);

        // Assert
        await UsingDbContextAsync(async context =>
        {
            var user = await context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.EmailAddress == input.EmailAddress && u.TenantId == 1);

            user.ShouldNotBeNull($"User {input.EmailAddress} not found in Tenant 1.");
            user.PhoneNumber.ShouldBe(input.PhoneNumber);
            user.Country.ShouldBe(input.Country);
            user.IsActive.ShouldBeFalse();
        });
    }

    [Fact]
    public async Task RegisterPrimeShipSeller_Test()
    {
        // Arrange
        var input = new RegisterPrimeShipInput
        {
            EmailAddress = "seller@primeship.com",
            FullName = "Prime Seller",
            Password = "TestPassword123!",
            PhoneNumber = "1122334455",
            Country = "Canada"
        };

        // Act
        await _accountAppService.RegisterPrimeShipSeller(input);

        // Assert
        await UsingDbContextAsync(async context =>
        {
            var user = await context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.EmailAddress == input.EmailAddress && u.TenantId == 2);

            user.ShouldNotBeNull($"User {input.EmailAddress} not found in Tenant 2.");
            user.PhoneNumber.ShouldBe(input.PhoneNumber);
            user.Country.ShouldBe(input.Country);
            user.IsActive.ShouldBeFalse();
        });
    }
}
