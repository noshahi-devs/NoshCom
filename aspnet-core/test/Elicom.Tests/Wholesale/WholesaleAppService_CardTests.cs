using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Elicom.Cards;
using Elicom.Categories;
using Elicom.Categories.Dto;
using Elicom.Products;
using Elicom.Products.Dto;
using Elicom.Wholesale;
using Elicom.Wholesale.Dto;
using Shouldly;
using Xunit;

namespace Elicom.Tests.Wholesale
{
    public class WholesaleAppService_CardTests : ElicomTestBase
    {
        private readonly IWholesaleAppService _wholesaleAppService;
        private readonly IProductAppService _productAppService;
        private readonly ICategoryAppService _categoryAppService;
        private readonly ICardAppService _cardAppService;

        public WholesaleAppService_CardTests()
        {
            _wholesaleAppService = Resolve<IWholesaleAppService>();
            _productAppService = Resolve<IProductAppService>();
            _categoryAppService = Resolve<ICategoryAppService>();
            _cardAppService = Resolve<ICardAppService>();
        }

        [Fact]
        public async Task Should_Process_EasyFinora_Card_Payment_During_Wholesale_Order()
        {
            // 1. Arrange: Create a card in Tenant 3 (Easy Finora) with balance
            const string cardNumber = "4319952196637239";
            const string expiryDate = "01/29";
            const string cvv = "597";
            const decimal initialBalance = 500.00m;
            const decimal orderAmount = 100.00m;

            UsingDbContext(3, context =>
            {
                var user = context.Users.First(u => u.TenantId == 3);
                context.VirtualCards.Add(new Elicom.Cards.VirtualCard
                {
                    TenantId = 3,
                    UserId = user.Id,
                    CardNumber = cardNumber,
                    CardType = CardType.Visa,
                    HolderName = "TEST USER",
                    ExpiryDate = expiryDate,
                    Cvv = cvv,
                    Balance = initialBalance,
                    Currency = "USD",
                    Status = "Active"
                });
            });

            // 2. Arrange: Create a product in Tenant 2 (Prime Ship)
            Guid productId;
            LoginAsTenant("primeship", "admin");
            
            var category = await _categoryAppService.Create(new CreateCategoryDto
            {
                Name = "Test Category",
                Slug = "test-category",
                Status = true,
                TenantId = 2
            });

            var product = await _productAppService.Create(new CreateProductDto
            {
                Name = "Test Product",
                CategoryId = category.Id,
                SupplierPrice = orderAmount, // Set price to match our orderAmount (1 item)
                StockQuantity = 100,
                SKU = "TEST-SKU",
                Status = true,
                TenantId = 2
            });
            productId = product.Id;

            // 3. Act: Place Wholesale Order with EasyFinora Card details (Deduction should happen cross-tenant)
            var input = new CreateWholesaleOrderInput
            {
                Items = new List<WholesaleOrderItemInput>
                {
                    new WholesaleOrderItemInput { ProductId = productId, Quantity = 1 }
                },
                ShippingAddress = "123 Test St",
                CustomerName = "Card Tester",
                PaymentMethod = "finora",
                CardNumber = cardNumber,
                ExpiryDate = expiryDate,
                Cvv = cvv
            };

            var order = await _wholesaleAppService.PlaceWholesaleOrder(input);

            // 4. Assert: Order created
            order.ShouldNotBeNull();
            order.TotalPurchaseAmount.ShouldBe(orderAmount);

            // 5. Assert: Card balance deducted in Tenant 3
            UsingDbContext(3, context =>
            {
                var card = context.VirtualCards.First(c => c.CardNumber == cardNumber);
                card.Balance.ShouldBe(initialBalance - orderAmount);
            });
        }

        [Fact]
        public async Task Should_Fail_Wholesale_Order_If_Card_Balance_Insufficient()
        {
            // 1. Arrange: Create a card in Tenant 3 with LOW balance
            const string cardNumber = "4319952196637238";
            const string expiryDate = "01/29";
            const string cvv = "555";
            const decimal initialBalance = 10.00m;
            const decimal orderAmount = 100.00m;

            UsingDbContext(3, context =>
            {
                var user = context.Users.First(u => u.TenantId == 3);
                context.VirtualCards.Add(new Elicom.Cards.VirtualCard
                {
                    TenantId = 3,
                    UserId = user.Id,
                    CardNumber = cardNumber,
                    CardType = CardType.Visa,
                    HolderName = "POOR USER",
                    ExpiryDate = expiryDate,
                    Cvv = cvv,
                    Balance = initialBalance,
                    Currency = "USD",
                    Status = "Active"
                });
            });

            // 2. Arrange: Create product in Tenant 2
            LoginAsTenant("primeship", "admin");
            var category = await _categoryAppService.Create(new CreateCategoryDto { Name = "Cat2", Slug = "cat2", Status = true, TenantId = 2 });
            var product = await _productAppService.Create(new CreateProductDto { Name = "Expensive Item", CategoryId = category.Id, SupplierPrice = orderAmount, SKU = "EXP-01", Status = true, TenantId = 2 });

            // 3. Act & Assert: Should throw UserFriendlyException for insufficient balance
            var input = new CreateWholesaleOrderInput
            {
                Items = new List<WholesaleOrderItemInput> { new WholesaleOrderItemInput { ProductId = product.Id, Quantity = 1 } },
                ShippingAddress = "Address",
                CustomerName = "Tester",
                PaymentMethod = "finora",
                CardNumber = cardNumber,
                ExpiryDate = expiryDate,
                Cvv = cvv
            };

            await Assert.ThrowsAsync<Abp.UI.UserFriendlyException>(async () =>
            {
                await _wholesaleAppService.PlaceWholesaleOrder(input);
            });
        }
        [Fact]
        public async Task Should_Charge_SupplierPrice_Not_RetailPrice()
        {
            // 1. Arrange: Create a card in Tenant 3
            const string cardNumber = "4319952196637999";
            const string expiryDate = "12/30";
            const string cvv = "123";
            const decimal initialBalance = 1000.00m;
            
            const decimal retailPrice = 200.00m;
            const decimal supplierPrice = 23.00m;

            UsingDbContext(3, context =>
            {
                var user = context.Users.First(u => u.TenantId == 3);
                context.VirtualCards.Add(new Elicom.Cards.VirtualCard
                {
                    TenantId = 3,
                    UserId = user.Id,
                    CardNumber = cardNumber,
                    CardType = CardType.Visa,
                    HolderName = "PRICE TESTER",
                    ExpiryDate = expiryDate,
                    Cvv = cvv,
                    Balance = initialBalance,
                    Currency = "USD",
                    Status = "Active"
                });
            });

            // 2. Arrange: Create a product in Tenant 2 with different Retail and Supplier prices
            LoginAsTenant("primeship", "admin");
            
            var category = await _categoryAppService.Create(new CreateCategoryDto
            {
                Name = "Price Verify Cat",
                Slug = "price-verify",
                Status = true,
                TenantId = 2
            });

            var product = await _productAppService.Create(new CreateProductDto
            {
                Name = "Price Discrepancy Item",
                CategoryId = category.Id,
                SupplierPrice = supplierPrice, // The cost (should be charged)
                ResellerMaxPrice = retailPrice, // The retail price (should be ignored)
                StockQuantity = 50,
                SKU = "PRC-001",
                Status = true,
                TenantId = 2
            });

            // 3. Act: Place Wholesale Order
            var input = new CreateWholesaleOrderInput
            {
                Items = new List<WholesaleOrderItemInput>
                {
                    new WholesaleOrderItemInput { ProductId = product.Id, Quantity = 1 }
                },
                ShippingAddress = "123 Verified St",
                CustomerName = "Price Verifier",
                PaymentMethod = "finora",
                CardNumber = cardNumber,
                ExpiryDate = expiryDate,
                Cvv = cvv
            };

            var order = await _wholesaleAppService.PlaceWholesaleOrder(input);

            // 4. Assert: Order total should be SupplierPrice ($23), NOT RetailPrice ($200)
            order.TotalPurchaseAmount.ShouldBe(supplierPrice);

            // 5. Assert: Card balance deducted only by SupplierPrice
            UsingDbContext(3, context =>
            {
                var card = context.VirtualCards.First(c => c.CardNumber == cardNumber);
                card.Balance.ShouldBe(initialBalance - supplierPrice);
            });
        }
    }
}
