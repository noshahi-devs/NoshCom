using Elicom.Entities;
using Elicom.Orders;
using Elicom.Orders.Dto;
using Elicom.SupplierOrders;
using Elicom.SupplierOrders.Dto;
using Elicom.Wallets;
using Shouldly;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using Abp.BackgroundJobs;
using NSubstitute;
using Castle.MicroKernel.Registration;
using Elicom.Orders.BackgroundJobs;
using Elicom.BackgroundJobs;

namespace Elicom.Tests.Orders
{
    public class OrderAppService_Tests : ElicomTestBase
    {
        private readonly IOrderAppService _orderAppService;
        private readonly ISupplierOrderAppService _supplierOrderAppService;
        private readonly IWalletManager _walletManager;

        public OrderAppService_Tests()
        {
            _orderAppService = Resolve<IOrderAppService>();
            _supplierOrderAppService = Resolve<ISupplierOrderAppService>();
            _walletManager = Resolve<IWalletManager>();
        }

        [Fact]
        public async Task Should_Deduct_Funds_When_Order_Placed()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            
            using (var uow = uowManager.Begin())
            {
                // Arrange
                var user = await GetCurrentUserAsync();
                await _walletManager.DepositAsync(user.Id, 5000, "TEST-DEP", "Test Deposit");
                await uowManager.Current.SaveChangesAsync(); // Commit deposit

                // 1. Check Initial Balance
                (await _walletManager.GetBalanceAsync(user.Id)).ShouldBe(5000);

                // 2. Debit
                bool result = await _walletManager.TryDebitAsync(user.Id, 1000, "ORD-TEST", "Order Payment");
                await uowManager.Current.SaveChangesAsync();

                // Assert
                result.ShouldBeTrue();
                (await _walletManager.GetBalanceAsync(user.Id)).ShouldBe(4000);
                
                await uow.CompleteAsync();
            }
        }

        [Fact]
        public async Task Should_Fail_Debit_If_Insufficient_Funds()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                var user = await GetCurrentUserAsync();
                // Balance is 0 by default

                bool result = await _walletManager.TryDebitAsync(user.Id, 1000, "FAIL-TEST", "Bad Order");

                result.ShouldBeFalse();
                await uow.CompleteAsync();
            }
        }
        [Fact]
        public async Task Should_Create_Order_And_Forward_To_Suppliers()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // 1. Setup: Category, Store, Products, Wallet
                var category = UsingDbContext(context => {
                    var c = new Category { Name = "Elect", Slug = "elect", Status = true };
                    context.Categories.Add(c);
                    context.SaveChanges();
                    return c;
                });

                var store = UsingDbContext(context => {
                    var s = new Store { Name = "Main Store", OwnerId = user.Id, Status = true, Slug = "main" };
                    context.Stores.Add(s);
                    context.SaveChanges();
                    return s;
                });

                var supplierId1 = user.Id; // Using same user as supplier for simplicity
                var product = UsingDbContext(context => {
                    var p = new Product { 
                        Name = "Prod1", CategoryId = category.Id, SupplierId = supplierId1, 
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

                // Add to Cart
                UsingDbContext(context => {
                    context.CartItems.Add(new CartItem { 
                        UserId = user.Id, StoreProductId = storeProduct.Id, Price = 150, Quantity = 2, Status = "Active", TenantId = 1
                    });
                    context.SaveChanges();
                });

                // Wallet Balance
                await _walletManager.DepositAsync(user.Id, 1000, "DEP", "Deposit");
                await uowManager.Current.SaveChangesAsync();

                // 2. Act: Create Order
                var orderDto = await _orderAppService.Create(new CreateOrderDto {
                    UserId = user.Id,
                    PaymentMethod = "Wallet",
                    ShippingCost = 10,
                    ShippingAddress = "123 Street"
                });

                await uowManager.Current.SaveChangesAsync();

                // 3. Assert: Order exists
                var order = UsingDbContext(context => context.Orders.First(o => o.Id == orderDto.Id));
                order.PaymentStatus.ShouldBe("Held in Escrow");

                // 4. Assert: Supplier Order created!
                var supplierOrder = UsingDbContext(context => context.SupplierOrders.FirstOrDefault(so => so.OrderId == order.Id));
                supplierOrder.ShouldNotBeNull();
                supplierOrder.SupplierId.ShouldBe(supplierId1);
                supplierOrder.TotalPurchaseAmount.ShouldBe(200); // 100 * 2

                await uow.CompleteAsync();
            }
        }

        [Fact]
        public async Task Should_Distribute_Profit_When_Order_Delivered()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // Setup similar to above
                var category = UsingDbContext(context => {
                    var c = new Category { Name = "Elect2", Slug = "elect2", Status = true };
                    context.Categories.Add(c);
                    context.SaveChanges();
                    return c;
                });

                var store = UsingDbContext(context => {
                    var s = new Store { Name = "Main Store 2", OwnerId = user.Id, Status = true, Slug = "main2" };
                    context.Stores.Add(s);
                    context.SaveChanges();
                    return s;
                });

                var supplierId = user.Id; // Using same user for simplicity
                var product = UsingDbContext(context => {
                    var p = new Product { 
                        Name = "Prod2", CategoryId = category.Id, SupplierId = supplierId, 
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
                    ShippingAddress = "123 Street"
                });

                await uowManager.Current.SaveChangesAsync();

                // Now Fulfill (Seller)
                await _orderAppService.Fulfill(new FulfillOrderDto { 
                    Id = orderDto.Id.ToString(), 
                    CarrierId = "DHL", 
                    TrackingCode = "REF-123",
                    ShipmentDate = DateTime.Now
                });
                await uowManager.Current.SaveChangesAsync();

                // Check balances before delivery
                // Buyer paid 150. Balance started at 1000 + 1000 (deposit) - 150 = 1850? 
                // Wait, GetMyWallet auto-creates with 0. Deposit adds 1000. So 1000 - 150 = 850.
                (await _walletManager.GetBalanceAsync(user.Id)).ShouldBe(850);

                // Act: Verify (Admin)
                await _orderAppService.Verify(new VerifyOrderDto { Id = orderDto.Id.ToString() });
                await uowManager.Current.SaveChangesAsync();

                // Act: Deliver (Admin)
                await _orderAppService.Deliver(new VerifyOrderDto { Id = orderDto.Id.ToString() });
                await uowManager.Current.SaveChangesAsync();

                // Assert: 
                // Total balance: 850 + 135 (Sale - Fee) = 985.
                (await _walletManager.GetBalanceAsync(user.Id)).ShouldBe(985);

                await uow.CompleteAsync();
            }
        }
        [Fact]
        public async Task Should_Create_Order_For_Primeship_With_External_Payment()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // Setup Category and Product
                var category = UsingDbContext(context => {
                    var c = new Category { Name = "Fashion", Slug = "fashion", Status = true };
                    context.Categories.Add(c);
                    context.SaveChanges();
                    return c;
                });

                var store = UsingDbContext(context => {
                    var s = new Store { Name = "Prime Ship Warehouse", OwnerId = user.Id, Status = true, Slug = "ps-warehouse" };
                    context.Stores.Add(s);
                    context.SaveChanges();
                    return s;
                });

                var product = UsingDbContext(context => {
                    var p = new Product { 
                        Name = "T-Shirt", CategoryId = category.Id, SupplierId = user.Id, 
                        SupplierPrice = 10, ResellerMaxPrice = 50, StockQuantity = 100, Status = true 
                    };
                    context.Products.Add(p);
                    context.SaveChanges();
                    return p;
                });

                var storeProduct = UsingDbContext(context => {
                    var sp = new StoreProduct { 
                        StoreId = store.Id, ProductId = product.Id, ResellerPrice = 40, Status = true, StockQuantity = 100 
                    };
                    context.StoreProducts.Add(sp);
                    context.SaveChanges();
                    return sp;
                });

                // Add to Cart
                UsingDbContext(context => {
                    context.CartItems.Add(new CartItem { 
                        UserId = user.Id, StoreProductId = storeProduct.Id, Price = 40, Quantity = 1, Status = "Active", TenantId = 1
                    });
                    context.SaveChanges();
                });

                // Act: Create Order for PrimeShip
                await _orderAppService.Create(new CreateOrderDto {
                    UserId = user.Id,
                    PaymentMethod = "MasterCard",
                    ShippingCost = 5,
                    ShippingAddress = "456 Fashion Blvd",
                    City = "London",
                    Country = "UK",
                    SourcePlatform = "PrimeShip"
                });

                await uowManager.Current.SaveChangesAsync();

                // Assert: Order exists and source is PrimeShip
                var order = UsingDbContext(context => context.Orders.First(o => o.UserId == user.Id));
                order.SourcePlatform.ShouldBe("PrimeShip");
                order.PaymentMethod.ShouldBe("MasterCard");
                order.PaymentStatus.ShouldBe("Paid (External)");
                order.TotalAmount.ShouldBe(45); // 40 + 5

                await uow.CompleteAsync();
            }
        }

        [Fact]
        public async Task Should_Get_All_Orders_For_Admin()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // Setup: Create test supplier orders directly
                var referenceCodes = UsingDbContext(context => {
                    var so1 = new SupplierOrder { 
                        ReferenceCode = "SUP-101", 
                        CustomerName = "C1", 
                        Status = "Purchased", 
                        TotalPurchaseAmount = 100,
                        ResellerId = user.Id,
                        SupplierId = user.Id
                    };
                    var so2 = new SupplierOrder { 
                        ReferenceCode = "SUP-102", 
                        CustomerName = "C2", 
                        Status = "Purchased", 
                        TotalPurchaseAmount = 200,
                        ResellerId = user.Id,
                        SupplierId = user.Id
                    };
                    context.SupplierOrders.Add(so1);
                    context.SupplierOrders.Add(so2);
                    context.SaveChanges();
                    return new[] { so1.ReferenceCode, so2.ReferenceCode };
                });

                // Act: Get all orders
                var allOrdersResult = await _supplierOrderAppService.GetAll();

                // Assert
                allOrdersResult.ShouldNotBeNull();
                allOrdersResult.Items.Count.ShouldBeGreaterThanOrEqualTo(2);
                allOrdersResult.Items.Any(o => o.ReferenceCode == "SUP-101").ShouldBeTrue();
                allOrdersResult.Items.Any(o => o.ReferenceCode == "SUP-102").ShouldBeTrue();

                await uow.CompleteAsync();
            }
        }

        [Fact]
        public async Task Should_Update_Order_Status()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // Setup: Create test order
                var category = UsingDbContext(context => {
                    var c = new Category { Name = "StatusCat", Slug = "statuscat", Status = true };
                    context.Categories.Add(c);
                    context.SaveChanges();
                    return c;
                });

                var store = UsingDbContext(context => {
                    var s = new Store { Name = "Status Store", OwnerId = user.Id, Status = true, Slug = "statusstore" };
                    context.Stores.Add(s);
                    context.SaveChanges();
                    return s;
                });

                var product = UsingDbContext(context => {
                    var p = new Product { 
                        Name = "StatusProduct", CategoryId = category.Id, SupplierId = user.Id, 
                        SupplierPrice = 30, ResellerMaxPrice = 60, StockQuantity = 10, Status = true 
                    };
                    context.Products.Add(p);
                    context.SaveChanges();
                    return p;
                });

                var storeProduct = UsingDbContext(context => {
                    var sp = new StoreProduct { 
                        StoreId = store.Id, ProductId = product.Id, ResellerPrice = 45, Status = true, StockQuantity = 10 
                    };
                    context.StoreProducts.Add(sp);
                    context.SaveChanges();
                    return sp;
                });

                UsingDbContext(context => {
                    context.CartItems.Add(new CartItem { 
                        UserId = user.Id, StoreProductId = storeProduct.Id, Price = 45, Quantity = 1, Status = "Active", TenantId = 1
                    });
                    context.SaveChanges();
                });

                await _walletManager.DepositAsync(user.Id, 1000, "DEP", "Deposit");
                await uowManager.Current.SaveChangesAsync();

                var orderDto = await _orderAppService.Create(new CreateOrderDto {
                    UserId = user.Id,
                    PaymentMethod = "Wallet",
                    ShippingCost = 5,
                    ShippingAddress = "Test Address"
                });

                await uowManager.Current.SaveChangesAsync();

                // Verify initial status
                orderDto.Status.ShouldBe("Pending");

                // Act: Fulfill
                var updatedOrder = await _orderAppService.Fulfill(new FulfillOrderDto {
                    Id = orderDto.Id.ToString(),
                    CarrierId = "Carrier1",
                    TrackingCode = "TRACK-1",
                    ShipmentDate = DateTime.Now
                });

                await uowManager.Current.SaveChangesAsync();

                // Assert
                updatedOrder.ShouldNotBeNull();
                updatedOrder.Status.ShouldBe("PendingVerification");

                // Act: Verify
                var verifiedOrder = await _orderAppService.Verify(new VerifyOrderDto { Id = orderDto.Id.ToString() });
                await uowManager.Current.SaveChangesAsync();

                // Assert
                verifiedOrder.Status.ShouldBe("Verified");

                // Act: Deliver
                var deliveredOrder = await _orderAppService.Deliver(new VerifyOrderDto { Id = orderDto.Id.ToString() });

                await uowManager.Current.SaveChangesAsync();

                // Assert: Status should be Delivered and PaymentStatus should be Completed
                deliveredOrder.Status.ShouldBe("Delivered");
                deliveredOrder.PaymentStatus.ShouldBe("Completed");

                await uow.CompleteAsync();
            }
        }

        [Fact]
        public async Task Should_Reject_Invalid_Status_Update()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // Setup: Create test order
                var category = UsingDbContext(context => {
                    var c = new Category { Name = "InvalidCat", Slug = "invalidcat", Status = true };
                    context.Categories.Add(c);
                    context.SaveChanges();
                    return c;
                });

                var store = UsingDbContext(context => {
                    var s = new Store { Name = "Invalid Store", OwnerId = user.Id, Status = true, Slug = "invalidstore" };
                    context.Stores.Add(s);
                    context.SaveChanges();
                    return s;
                });

                var product = UsingDbContext(context => {
                    var p = new Product { 
                        Name = "InvalidProduct", CategoryId = category.Id, SupplierId = user.Id, 
                        SupplierPrice = 20, ResellerMaxPrice = 40, StockQuantity = 10, Status = true 
                    };
                    context.Products.Add(p);
                    context.SaveChanges();
                    return p;
                });

                var storeProduct = UsingDbContext(context => {
                    var sp = new StoreProduct { 
                        StoreId = store.Id, ProductId = product.Id, ResellerPrice = 30, Status = true, StockQuantity = 10 
                    };
                    context.StoreProducts.Add(sp);
                    context.SaveChanges();
                    return sp;
                });

                UsingDbContext(context => {
                    context.CartItems.Add(new CartItem { 
                        UserId = user.Id, StoreProductId = storeProduct.Id, Price = 30, Quantity = 1, Status = "Active", TenantId = 1
                    });
                    context.SaveChanges();
                });

                await _walletManager.DepositAsync(user.Id, 1000, "DEP", "Deposit");
                await uowManager.Current.SaveChangesAsync();

                var orderDto = await _orderAppService.Create(new CreateOrderDto {
                    UserId = user.Id,
                    PaymentMethod = "Wallet",
                    ShippingCost = 5,
                    ShippingAddress = "Test Address"
                });

                await uowManager.Current.SaveChangesAsync();

                // Act & Assert: Try to Verify when not in PendingVerification
                await Should.ThrowAsync<Abp.UI.UserFriendlyException>(async () =>
                {
                    await _orderAppService.Verify(new VerifyOrderDto {
                        Id = orderDto.Id.ToString()
                    });
                });

                await uow.CompleteAsync();
            }
        }
        [Fact]
        public async Task Should_Update_Wholesale_Order_Status()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // Setup: Create test wholesale order
                var soId = UsingDbContext(context => {
                    var so = new SupplierOrder { 
                        ReferenceCode = "SUP-UPDATE", 
                        CustomerName = "C-UPDATE", 
                        Status = "Purchased", 
                        TotalPurchaseAmount = 500,
                        ResellerId = user.Id,
                        SupplierId = user.Id
                    };
                    context.SupplierOrders.Add(so);
                    context.SaveChanges();
                    return so.Id;
                });

                // Act: Update status to Shipped
                var updatedOrder = await _supplierOrderAppService.UpdateStatus(new Elicom.Orders.Dto.UpdateOrderStatusDto {
                    Id = soId,
                    Status = "Shipped"
                });

                await uowManager.Current.SaveChangesAsync();

                // Assert
                updatedOrder.ShouldNotBeNull();
                updatedOrder.Status.ShouldBe("Shipped");

                await uow.CompleteAsync();
            }
        }

        [Fact]
        public async Task Should_Enqueue_Email_Job_When_Order_Created()
        {
            var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            
            // Mock BackgroundJobManager
            var backgroundJobManager = Substitute.For<IBackgroundJobManager>();
            LocalIocManager.IocContainer.Register(
                Component.For<IBackgroundJobManager>().Instance(backgroundJobManager).LifestyleSingleton().IsDefault()
            );
            
            // Resolve OrderAppService again so it gets the mock
            var orderAppService = Resolve<IOrderAppService>();

            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // Setup minimal data
                var category = UsingDbContext(context => {
                    var c = new Category { Name = "JobTest", Slug = "jobtest", Status = true };
                    context.Categories.Add(c);
                    context.SaveChanges();
                    return c;
                });

                var store = UsingDbContext(context => {
                    var s = new Store { Name = "Job Store", OwnerId = user.Id, Status = true, Slug = "job" };
                    context.Stores.Add(s);
                    context.SaveChanges();
                    return s;
                });

                var product = UsingDbContext(context => {
                    var p = new Product { 
                        Name = "JobProd", CategoryId = category.Id, SupplierId = user.Id, 
                        SupplierPrice = 10, StockQuantity = 10, Status = true 
                    };
                    context.Products.Add(p);
                    context.SaveChanges();
                    return p;
                });

                var storeProduct = UsingDbContext(context => {
                    var sp = new StoreProduct { 
                        StoreId = store.Id, ProductId = product.Id, ResellerPrice = 20, Status = true, StockQuantity = 10 
                    };
                    context.StoreProducts.Add(sp);
                    context.SaveChanges();
                    return sp;
                });

                UsingDbContext(context => {
                    context.CartItems.Add(new CartItem { 
                        UserId = user.Id, StoreProductId = storeProduct.Id, Price = 20, Quantity = 1, Status = "Active", TenantId = 1
                    });
                    context.SaveChanges();
                });

                // Act
                var orderDto = await orderAppService.Create(new CreateOrderDto {
                    UserId = user.Id,
                    PaymentMethod = "Visa",
                    ShippingCost = 0,
                    ShippingAddress = "Job Test Addr"
                });

                await uowManager.Current.SaveChangesAsync();

                // Assert: Verify EnqueueAsync was called with correct arguments
                await backgroundJobManager.Received().EnqueueAsync<OrderEmailJob, OrderEmailJobArgs>(
                    Arg.Is<OrderEmailJobArgs>(args => args.OrderId == orderDto.Id)
                );

                await uow.CompleteAsync();
            }
        }
    }
}
