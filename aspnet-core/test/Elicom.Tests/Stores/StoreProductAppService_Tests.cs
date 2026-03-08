using Elicom.StoreProducts;
using Elicom.StoreProducts.Dto;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using Elicom.Entities;
using Abp.Application.Services.Dto;

namespace Elicom.Tests.Stores
{
    public class StoreProductAppService_Tests : ElicomTestBase
    {
        private readonly IStoreProductAppService _storeProductAppService;

        public StoreProductAppService_Tests()
        {
            _storeProductAppService = Resolve<IStoreProductAppService>();
        }

        [Fact]
        public async Task GetByStore_Should_Return_Only_Mapped_And_Active_Products()
        {
            // Arrange
            Guid storeId = Guid.NewGuid();
            Guid otherStoreId = Guid.NewGuid();
            Guid p1Id = Guid.NewGuid();
            Guid p2Id = Guid.NewGuid();
            Guid p3Id = Guid.NewGuid();

            await UsingDbContextAsync(async context =>
            {
                // Ensure we are adding for the current tenant (Default 1)
                int tenantId = 1;

                // 1. Add Products
                context.Products.Add(new Product { Id = p1Id, Name = "Product 1", SKU = "SKU1", SupplierPrice = 10, TenantId = tenantId });
                context.Products.Add(new Product { Id = p2Id, Name = "Product 2", SKU = "SKU2", SupplierPrice = 20, TenantId = tenantId });
                context.Products.Add(new Product { Id = p3Id, Name = "Product 3", SKU = "SKU3", SupplierPrice = 30, TenantId = tenantId });

                // 2. Map Products to Store (Status = true)
                context.StoreProducts.Add(new StoreProduct { Id = Guid.NewGuid(), StoreId = storeId, ProductId = p1Id, ResellerPrice = 15, Status = true });
                
                // 3. Map Product 2 but with Status = false (Should NOT show up)
                context.StoreProducts.Add(new StoreProduct { Id = Guid.NewGuid(), StoreId = storeId, ProductId = p2Id, ResellerPrice = 25, Status = false });

                // 4. Map Product 3 to ANOTHER store (Should NOT show up for storeId)
                context.StoreProducts.Add(new StoreProduct { Id = Guid.NewGuid(), StoreId = otherStoreId, ProductId = p3Id, ResellerPrice = 35, Status = true });
            });

            // Act
            var result = await _storeProductAppService.GetByStore(storeId);

            // Assert
            result.Items.Count.ShouldBe(1);
            result.Items[0].ProductId.ShouldBe(p1Id);
            result.Items[0].ProductName.ShouldBe("Product 1");
        }

        [Fact]
        public async Task GetByStore_Should_Return_Products_From_Other_Tenants()
        {
            // Arrange
            Guid storeId = Guid.NewGuid();
            Guid hostProductId = Guid.NewGuid();
            Guid otherTenantProductId = Guid.NewGuid();

            await UsingDbContextAsync(async context =>
            {
                // 1. Host Product (TenantId = null)
                context.Products.Add(new Product { Id = hostProductId, Name = "Host Product", SKU = "HOST-SKU", SupplierPrice = 10, TenantId = null });
                
                // 2. Other Tenant Product
                context.Products.Add(new Product { Id = otherTenantProductId, Name = "Other Tenant Product", SKU = "OTHER-SKU", SupplierPrice = 20, TenantId = 999 });

                // Map both to current store
                context.StoreProducts.Add(new StoreProduct { Id = Guid.NewGuid(), StoreId = storeId, ProductId = hostProductId, ResellerPrice = 15, Status = true });
                context.StoreProducts.Add(new StoreProduct { Id = Guid.NewGuid(), StoreId = storeId, ProductId = otherTenantProductId, ResellerPrice = 25, Status = true });
            });

            // Act
            var result = await _storeProductAppService.GetByStore(storeId);

            // Assert
            // Without the DisableFilter fix, these would be filtered out by ABP
            result.Items.Count.ShouldBe(2);
            result.Items.Any(i => i.ProductName == "Host Product").ShouldBeTrue();
            result.Items.Any(i => i.ProductName == "Other Tenant Product").ShouldBeTrue();
        }

        [Fact]
        public async Task MapProductToStore_Should_Prevent_Duplicate_Mappings()
        {
            // Arrange
            Guid storeId = Guid.NewGuid();
            Guid productId = Guid.NewGuid();

            await UsingDbContextAsync(async context =>
            {
                context.Products.Add(new Product { Id = productId, Name = "Unique Product", SKU = "UNIQUE", SupplierPrice = 10 });
                context.StoreProducts.Add(new StoreProduct { Id = Guid.NewGuid(), StoreId = storeId, ProductId = productId, ResellerPrice = 15, Status = true });
            });

            var duplicateInput = new MapProductDto
            {
                StoreId = storeId,
                ProductId = productId,
                ResellerPrice = 20,
                Status = true,
                StockQuantity = 10
            };

            // Act & Assert
            await Should.ThrowAsync<Abp.UI.UserFriendlyException>(async () =>
            {
                await _storeProductAppService.MapProductToStore(duplicateInput);
            });
        }

        [Fact]
        public async Task GetByStore_Should_Return_Empty_When_No_Mappings_Exist()
        {
            // Arrange
            Guid emptyStoreId = Guid.NewGuid();

            // Act
            var result = await _storeProductAppService.GetByStore(emptyStoreId);

            // Assert
            result.Items.ShouldBeEmpty();
        }
    }
}
