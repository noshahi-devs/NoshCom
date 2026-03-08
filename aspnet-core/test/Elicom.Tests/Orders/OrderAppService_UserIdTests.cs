using Elicom.Entities;
using Elicom.Orders;
using Elicom.Orders.Dto;
using Elicom.Carts;
using Elicom.Carts.Dto;
using Elicom.Wallets;
using Shouldly;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Elicom.Tests.Orders
{
    public class OrderAppService_UserIdTests : ElicomTestBase
    {
        private readonly IOrderAppService _orderAppService;
        private readonly ICartAppService _cartAppService;
        private readonly IWalletManager _walletManager;

        public OrderAppService_UserIdTests()
        {
            _orderAppService = Resolve<IOrderAppService>();
            _cartAppService = Resolve<ICartAppService>();
            _walletManager = Resolve<IWalletManager>();
        }

        [Fact]
        public async Task Should_Create_Order_Using_UserId_Without_Profile()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // 1. Setup Data
                var category = UsingDbContext(context => {
                    var c = new Category { Name = "Test Cat", Slug = "test-cat", Status = true };
                    context.Categories.Add(c);
                    context.SaveChanges();
                    return c;
                });

                var store = UsingDbContext(context => {
                    var s = new Store { Name = "Test Store", OwnerId = user.Id, Status = true, Slug = "test-store" };
                    context.Stores.Add(s);
                    context.SaveChanges();
                    return s;
                });

                var product = UsingDbContext(context => {
                    var p = new Product { 
                        Name = "Test Product", CategoryId = category.Id, SupplierId = user.Id, 
                        SupplierPrice = 100, ResellerMaxPrice = 200, StockQuantity = 10, Status = true 
                    };
                    context.Products.Add(p);
                    context.SaveChanges();
                    return p;
                });

                var storeProduct = UsingDbContext(context => {
                    var sp = new StoreProduct { 
                        StoreId = store.Id, ProductId = product.Id, ResellerPrice = 150, Status = true, StockQuantity = 10 
                    };
                    context.StoreProducts.Add(sp);
                    context.SaveChanges();
                    return sp;
                });

                // 2. Add to Cart using UserId
                UsingDbContext(context => {
                    context.CartItems.Add(new CartItem { 
                        UserId = user.Id, StoreProductId = storeProduct.Id, Price = 150, Quantity = 1, Status = "Active", TenantId = 1
                    });
                    context.SaveChanges();
                });

                await uowManager.Current.SaveChangesAsync();

                // Verify Cart Item exists with UserId
                UsingDbContext(context => {
                    var items = context.CartItems.Where(ci => ci.UserId == user.Id).ToList();
                    items.Count.ShouldBe(1);
                    items.First().UserId.ShouldBe(user.Id);
                });

                // 3. Deposit funds
                await _walletManager.DepositAsync(user.Id, 1000, "DEP", "Test Deposit");
                await uowManager.Current.SaveChangesAsync();

                // 4. Create Order
                var orderDto = await _orderAppService.Create(new CreateOrderDto {
                    UserId = user.Id,
                    PaymentMethod = "Wallet",
                    ShippingCost = 0,
                    ShippingAddress = "Test Address",
                    SourcePlatform = "SmartStore"
                });

                await uowManager.Current.SaveChangesAsync();

                // 5. Assertions
                orderDto.ShouldNotBeNull();
                orderDto.UserId.ShouldBe(user.Id);
                orderDto.TotalAmount.ShouldBe(150);
                orderDto.PaymentStatus.ShouldBe("Held in Escrow");

                // Verify Order in DB
                UsingDbContext(context => {
                    var order = context.Orders.First(o => o.Id == orderDto.Id);
                    order.UserId.ShouldBe(user.Id);
                });

                // Verify Cart is cleared
                UsingDbContext(context => {
                    context.CartItems.Any(ci => ci.UserId == user.Id && ci.Status == "Active").ShouldBeFalse();
                });

                await uow.CompleteAsync();
            }
        }
    }
}
