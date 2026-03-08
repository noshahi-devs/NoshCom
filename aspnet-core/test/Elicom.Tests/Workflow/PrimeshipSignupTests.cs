using System;
using System.Threading.Tasks;
using Elicom.Authorization.Accounts;
using Elicom.Authorization.Accounts.Dto;
using Elicom.Authorization.Users;
using Elicom.Wholesale;
using Elicom.Wholesale.Dto;
using Elicom.Authorization.Roles;
using Shouldly;
using Xunit;
using System.Linq;
using System.Collections.Generic;
using Abp.Runtime.Session;
using Elicom.SmartStore;
using Elicom.Utils;
using Elicom.Entities;

namespace Elicom.Tests.Workflow
{
    public class PrimeshipSignupTests : ElicomTestBase
    {
        private readonly IAccountAppService _accountAppService;
        private readonly IWholesaleAppService _wholesaleService;
        private readonly UserManager _userManager;
        private readonly ISmartStorePublicAppService _publicAppService;

        public PrimeshipSignupTests()
        {
            _accountAppService = Resolve<IAccountAppService>();
            _wholesaleService = Resolve<IWholesaleAppService>();
            _userManager = Resolve<UserManager>();
            _publicAppService = Resolve<ISmartStorePublicAppService>();
        }

        [Fact]
        public async Task Signup_Should_Assign_Role_And_Allow_Wholesale_Order()
        {
            // NEW: Seed data first (Products, Categories, Stores)
            var seeder = Resolve<DataSeedingAppService>();
            LoginAsHostAdmin();
            await seeder.SeedAllData();

            // Arrange
            string testEmail = $"test_user_{Guid.NewGuid()}@primeshipuk.com";
            var signupInput = new RegisterPrimeShipInput
            {
                EmailAddress = testEmail,
                Password = "Noshahi.000",
                Country = "United Kingdom",
                PhoneNumber = "1234567890"
            };

            // Act: 1. Register as a Prime Ship Customer (Tenant 2, Reseller role)
            // Note: RegisterPrimeShipCustomer handles the tenant switching internally if implemented correctly,
            // but we'll ensure the session is clean.
            await _accountAppService.RegisterPrimeShipCustomer(signupInput);

            // Act: 2. Find the user and verify role (we need to be in Tenant 2 context)
            User user;
            using (AbpSession.Use(2, null))
            {
                user = await _userManager.FindByEmailAsync(testEmail);
                user.ShouldNotBeNull();
                
                // Act: Activate user directly in DB to avoid concurrency issues with UserManager
                UsingDbContext(2, context =>
                {
                    var u = context.Users.First(x => x.Id == user.Id);
                    u.IsActive = true;
                    u.IsEmailConfirmed = true;

                    // Give balance to the user's wallet
                    var wallet = context.Wallets.FirstOrDefault(w => w.UserId == u.Id);
                    if (wallet != null)
                    {
                        wallet.Balance = 1000000; // 1M balance
                    }
                });

                var roles = await _userManager.GetRolesAsync(user);
                roles.ShouldContain(StaticRoleNames.Tenants.Reseller);
            }

            // Act: 3. Place a wholesale order as this user
            using (AbpSession.Use(2, user.Id))
            {
                // We need at least one product in Tenant 2. 
                // In generic tests, products might be seeded in Tenant 1 (Global).
                // WholesaleAppService looks at _productRepository.
                
                // Let's get products from marketplace (Tenant 1) and assume they are accessible
                var marketplace = await _publicAppService.GetGlobalMarketplaceProducts();
                marketplace.Items.Count.ShouldBeGreaterThan(0);
                var firstProduct = marketplace.Items.First();

                var wholesaleOrder = await _wholesaleService.PlaceWholesaleOrder(new CreateWholesaleOrderInput
                {
                    CustomerName = "Test Customer",
                    ShippingAddress = "Test Address",
                    Items = new List<WholesaleOrderItemInput>
                    {
                        new WholesaleOrderItemInput { ProductId = firstProduct.ProductId, Quantity = 1 }
                    }
                });

                // Assert
                wholesaleOrder.ShouldNotBeNull();
                wholesaleOrder.ReferenceCode.ShouldStartWith("WHOLE-");
            }
        }
    }
}
