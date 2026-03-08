using System;
using System.Linq;
using System.Threading.Tasks;
using Elicom.SupplierOrders;
using Elicom.SupplierOrders.Dto;
using Elicom.Orders.Dto;
using Elicom.Entities;
using Shouldly;
using Xunit;
using Microsoft.EntityFrameworkCore;
using Abp.UI;

namespace Elicom.Tests.Orders
{
    public class SupplierOrder_Status_Tests : ElicomTestBase
    {
        private readonly ISupplierOrderAppService _supplierOrderAppService;

        public SupplierOrder_Status_Tests()
        {
            _supplierOrderAppService = Resolve<ISupplierOrderAppService>();
        }

        [Fact]
        public async Task Should_Flow_Through_All_Statuses_Sequentially()
        {
            // Login as admin
            LoginAsDefaultTenantAdmin();
            var user = await GetCurrentUserAsync();

            // 1. Create a "Pending" order
            var orderId = await UsingDbContextAsync(async context => {
                var so = new SupplierOrder
                {
                    ReferenceCode = "TEST-FLOW-101",
                    ResellerId = user.Id,
                    SupplierId = user.Id,
                    Status = "Purchased", // Initial status from UI is "Purchased" or "Pending"
                    TotalPurchaseAmount = 100,
                    CustomerName = "Test Customer",
                    ShippingAddress = "Test Address"
                };
                context.SupplierOrders.Add(so);
                await context.SaveChangesAsync();
                return so.Id;
            });

            // 2. Update to "Verified" (Using new flow method)
            await _supplierOrderAppService.MarkAsVerified(orderId);
            
            var order = await UsingDbContextAsync(async context => await context.SupplierOrders.FirstOrDefaultAsync(o => o.Id == orderId));
            order.Status.ShouldBe("Verified");

            // 3. Update to "Processing"
            await _supplierOrderAppService.UpdateStatus(new UpdateOrderStatusDto { Id = orderId, Status = "Processing" });
            order = await UsingDbContextAsync(async context => await context.SupplierOrders.FirstOrDefaultAsync(o => o.Id == orderId));
            order.Status.ShouldBe("Processing");

            // 4. Update to "Shipped" (Using special method)
            await _supplierOrderAppService.MarkAsShipped(new FulfillOrderDto { 
                Id = orderId.ToString(), CarrierId = "DHL", TrackingCode = "T123", ShipmentDate = DateTime.Now 
            });
            order = await UsingDbContextAsync(async context => await context.SupplierOrders.FirstOrDefaultAsync(o => o.Id == orderId));
            order.Status.ShouldBe("Shipped");

            // 5. Update to "Delivered"
            await _supplierOrderAppService.MarkAsDelivered(orderId);
            order = await UsingDbContextAsync(async context => await context.SupplierOrders.FirstOrDefaultAsync(o => o.Id == orderId));
            order.Status.ShouldBe("Delivered");
        }
    }
}
