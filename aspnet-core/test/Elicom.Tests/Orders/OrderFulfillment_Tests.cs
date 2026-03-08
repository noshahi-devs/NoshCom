using Elicom.Entities;
using Elicom.Orders;
using Elicom.Orders.Dto;
using Elicom.Wallets;
using Elicom.Authorization;
using Shouldly;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using Abp.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Elicom.Tests.Orders
{
    public class OrderFulfillment_Tests : ElicomTestBase
    {
        private readonly IOrderAppService _orderAppService;
        private readonly IWalletManager _walletManager;

        public OrderFulfillment_Tests()
        {
            _orderAppService = Resolve<IOrderAppService>();
            _walletManager = Resolve<IWalletManager>();
        }

        [Fact]
        public async Task Should_Execute_Full_Fulfillment_Workflow()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // 1. Setup: Category, Store, Product, StoreProduct
                var category = UsingDbContext(context => {
                    var c = new Category { Name = "TestCat", Slug = "testcat", Status = true };
                    context.Categories.Add(c);
                    context.SaveChanges();
                    return c;
                });

                var store = UsingDbContext(context => {
                    var s = new Store { Name = "Seller Store", OwnerId = user.Id, Status = true, Slug = "sellerstore" };
                    context.Stores.Add(s);
                    context.SaveChanges();
                    return s;
                });

                var product = UsingDbContext(context => {
                    var p = new Product { 
                        Name = "TestProduct", CategoryId = category.Id, SupplierId = user.Id, 
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

                // Add to Cart and Place Order
                UsingDbContext(context => {
                    context.CartItems.Add(new CartItem { 
                        UserId = user.Id, StoreProductId = storeProduct.Id, Price = 150, Quantity = 1, Status = "Active", TenantId = 1
                    });
                    context.SaveChanges();
                });

                await _walletManager.DepositAsync(user.Id, 1000, "DEP", "Deposit");
                await uowManager.Current.SaveChangesAsync();

                var orderDto = await _orderAppService.Create(new CreateOrderDto {
                    UserId = user.Id,
                    PaymentMethod = "Wallet",
                    ShippingCost = 0,
                    ShippingAddress = "Test Address"
                });
                await uowManager.Current.SaveChangesAsync();

                orderDto.Status.ShouldBe("Pending");

                // 2. Fulfill (Seller)
                var fulfilledOrder = await _orderAppService.Fulfill(new FulfillOrderDto {
                    Id = orderDto.Id.ToString(),
                    CarrierId = "DHL",
                    TrackingCode = "TRACK123",
                    ShipmentDate = DateTime.Now
                });
                await uowManager.Current.SaveChangesAsync();

                fulfilledOrder.Status.ShouldBe("PendingVerification");
                fulfilledOrder.TrackingCode.ShouldBe("TRACK123");

                // 3. Verify (Admin)
                var verifiedOrder = await _orderAppService.Verify(new VerifyOrderDto {
                    Id = orderDto.Id.ToString()
                });
                await uowManager.Current.SaveChangesAsync();

                verifiedOrder.Status.ShouldBe("Verified");

                // Check if Pending transactions are created
                var pendingTransaction = UsingDbContext(context => context.AppTransactions
                    .FirstOrDefault(t => t.OrderId == orderDto.Id && t.Status == "Pending"));
                
                pendingTransaction.ShouldNotBeNull();
                pendingTransaction.Amount.ShouldBe(150 * 0.9m); // 150 - 10% fee
                pendingTransaction.UserId.ShouldBe(user.Id);

                // Check Platform Fee transaction
                var feeTransaction = UsingDbContext(context => context.AppTransactions
                    .FirstOrDefault(t => t.OrderId == orderDto.Id && t.Category == "Fee"));
                
                feeTransaction.ShouldNotBeNull();
                feeTransaction.Amount.ShouldBe(150 * 0.1m);
                feeTransaction.Status.ShouldBe("Approved");

                // Check Seller Wallet (Should NOT have received funds yet)
                (await _walletManager.GetBalanceAsync(user.Id)).ShouldBe(850); // 1000 - 150

                // 4. Deliver (Admin)
                var deliveredOrder = await _orderAppService.Deliver(new VerifyOrderDto { Id = orderDto.Id.ToString() });
                await uowManager.Current.SaveChangesAsync();

                deliveredOrder.Status.ShouldBe("Delivered");

                // Check if transactions are Approved
                var approvedTransaction = UsingDbContext(context => context.AppTransactions
                    .FirstOrDefault(t => t.OrderId == orderDto.Id && t.Category == "Sale" && t.Status == "Approved"));
                
                approvedTransaction.ShouldNotBeNull();

                // Check Seller Wallet (Should have received funds)
                // Initial 1000 - 150 (Spent) + 135 (Sale) = 985
                (await _walletManager.GetBalanceAsync(user.Id)).ShouldBe(985);

                await uow.CompleteAsync();
            }
        }

        [Fact]
        public async Task Should_Prevent_Invalid_Transitions()
        {
             var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // Setup minimal order
                var category = UsingDbContext(context => {
                    var c = new Category { Name = "Cat3", Slug = "cat3", Status = true };
                    context.Categories.Add(c);
                    context.SaveChanges();
                    return c;
                });
                var store = UsingDbContext(context => {
                    var s = new Store { Name = "Store3", OwnerId = user.Id, Status = true, Slug = "s3" };
                    context.Stores.Add(s);
                    context.SaveChanges();
                    return s;
                });
                var product = UsingDbContext(context => {
                    var p = new Product { Name = "P3", CategoryId = category.Id, SupplierId = user.Id, SupplierPrice = 10, Status = true };
                    context.Products.Add(p);
                    context.SaveChanges();
                    return p;
                });
                var storeProduct = UsingDbContext(context => {
                    var sp = new StoreProduct { StoreId = store.Id, ProductId = product.Id, ResellerPrice = 20, Status = true };
                    context.StoreProducts.Add(sp);
                    context.SaveChanges();
                    return sp;
                });
                var order = UsingDbContext(context => {
                    var o = new Order { UserId = user.Id, OrderNumber = "ORD-INV", TotalAmount = 20, Status = "Pending" };
                    context.Orders.Add(o);
                    context.SaveChanges();
                    return o;
                });

                // Cannot Verify if not PendingVerification
                await Should.ThrowAsync<Abp.UI.UserFriendlyException>(async () =>
                {
                    await _orderAppService.Verify(new VerifyOrderDto { Id = order.Id.ToString() });
                });

                // Cannot Deliver if not Verified
                await Should.ThrowAsync<Abp.UI.UserFriendlyException>(async () =>
                {
                    await _orderAppService.Deliver(new VerifyOrderDto { Id = order.Id.ToString() });
                });

                await uow.CompleteAsync();
            }
        }
    }
}
