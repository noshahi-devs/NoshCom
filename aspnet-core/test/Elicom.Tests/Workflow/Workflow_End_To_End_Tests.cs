using System;
using System.Threading.Tasks;
using Elicom.Utils;
using Xunit;
using Shouldly;
using System.Linq;
using Elicom.SmartStore;
using Elicom.GlobalPay;
using Elicom.Wholesale;
using Elicom.GlobalPay.Dto;
using Elicom.Wholesale.Dto;
using Elicom.Orders;
using Elicom.Orders.Dto;
using System.Collections.Generic;

namespace Elicom.Tests.Workflow
{
    public class Workflow_EndToEnd_Tests : ElicomTestBase
    {
        private readonly DataSeedingAppService _seeder;
        private readonly ISmartStorePublicAppService _publicAppService;
        private readonly IDepositRequestAppService _depositService;
        private readonly IWholesaleAppService _wholesaleService;
        private readonly IOrderAppService _orderService;

        public Workflow_EndToEnd_Tests()
        {
            _seeder = Resolve<DataSeedingAppService>();
            _publicAppService = Resolve<ISmartStorePublicAppService>();
            _depositService = Resolve<IDepositRequestAppService>();
            _wholesaleService = Resolve<IWholesaleAppService>();
            _orderService = Resolve<IOrderAppService>();
        }

        [Fact]
        public async Task Execute_Complete_System_Flow()
        {
            // STEP 1: Seed the Data (5 Categories, 20 Products, 3 Stores)
            LoginAsHostAdmin();
            await _seeder.SeedAllData();

            // STEP 2: Verify Smart Store Public API
            var marketplace = await _publicAppService.GetGlobalMarketplaceProducts();
            marketplace.Items.Count.ShouldBeGreaterThan(0);
            
            // STEP 3: Financial Flow (GlobalPayUK)
            // User requests deposit
            var depositReq = await _depositService.Create(new CreateDepositRequestInput
            {
                Amount = 1000,
                Country = "UK",
                ProofImage = "screenshot_v1.png"
            });
            depositReq.Status.ShouldBe("Pending");

            // Admin approves deposit
            await _depositService.Approve(new ApproveDepositRequestInput
            {
                Id = depositReq.Id,
                AdminRemarks = "Payment verified"
            });

            // STEP 4: Prime Ship Wholesale Flow
            // Reseller buys a product wholesale for a customer
            var firstProduct = marketplace.Items.First();
            var wholesaleOrder = await _wholesaleService.PlaceWholesaleOrder(new CreateWholesaleOrderInput
            {
                CustomerName = "John Doe",
                ShippingAddress = "123 Main St, London",
                Items = new List<WholesaleOrderItemInput>
                {
                    new WholesaleOrderItemInput { ProductId = firstProduct.ProductId, Quantity = 1 }
                }
            });
            wholesaleOrder.ReferenceCode.ShouldStartWith("WHOLE-");

            // STEP 5: Smart Store Order Linking
            // Create a retail order (simulating buyer purchase)
            // Note: In real app buyer uses Smart Store Frontend. Here we simulate the linkage part.
            /*
            var linkResult = await _orderService.LinkWholesaleOrder(new LinkWholesaleOrderDto
            {
                OrderId = Guid.NewGuid(), // Placeholder for test
                WholesaleReferenceCode = wholesaleOrder.ReferenceCode
            }).ShouldThrowAsync<Exception>(); // Will fail because retail order ID is fake, but proves logic is active
            */
        }
    }
}
