using Elicom.Products;
using Elicom.StoreProducts;
using Elicom.StoreProducts.Dto;
using Elicom.Entities;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Threading.Tasks;
using Xunit;
using System.Linq;

namespace Elicom.Tests.Products
{
    public class ProductMapping_Tests : ElicomTestBase
    {
        private readonly IProductAppService _productAppService;
        private readonly IStoreProductAppService _storeProductAppService;

        public ProductMapping_Tests()
        {
            _productAppService = Resolve<IProductAppService>();
            _storeProductAppService = Resolve<IStoreProductAppService>();
        }

        [Fact]
        public async Task Search_Wholesale_Products_Test()
        {
            // Arrange
            var categoryId = Guid.NewGuid();
            await UsingDbContextAsync(async context =>
            {
                context.Categories.Add(new Category { Id = categoryId, Name = "Electronics" });
                context.Products.Add(new Product 
                { 
                    Id = Guid.NewGuid(), 
                    Name = "Wholesale Monitor", 
                    SKU = "MON-001", 
                    CategoryId = categoryId,
                    SupplierPrice = 100,
                    ResellerMaxPrice = 150,
                    Images = "[]",
                    Status = true
                });
            });

            // Act
            var result = await _productAppService.Search("Monitor");

            // Assert
            result.Items.Count.ShouldBeGreaterThan(0);
            result.Items.Any(i => i.Name == "Wholesale Monitor").ShouldBeTrue();
        }

        [Fact]
        public async Task Map_Product_To_Store_Test()
        {
            // Arrange
            var productId = Guid.NewGuid();
            var storeId = Guid.NewGuid();
            await UsingDbContextAsync(async context =>
            {
                var admin = await context.Users.FirstAsync(u => u.UserName == "admin");
                context.Stores.Add(new Store { Id = storeId, Name = "My Store", OwnerId = admin.Id, Slug = "my-store" });
                
                var categoryId = Guid.NewGuid();
                context.Categories.Add(new Category { Id = categoryId, Name = "Electronics" });
                context.Products.Add(new Product 
                { 
                    Id = productId, 
                    Name = "Keyboard", 
                    SKU = "KB-01", 
                    CategoryId = categoryId,
                    SupplierPrice = 20,
                    ResellerMaxPrice = 40,
                    Images = "[]"
                });
            });

            // Act
            await _storeProductAppService.MapProductToStore(new MapProductDto
            {
                StoreId = storeId,
                ProductId = productId,
                ResellerPrice = 35,
                StockQuantity = 50,
                Status = true
            });

            // Assert
            await UsingDbContextAsync(async context =>
            {
                var mapped = await context.StoreProducts.FirstOrDefaultAsync(sp => sp.StoreId == storeId && sp.ProductId == productId);
                mapped.ShouldNotBeNull();
                mapped.ResellerPrice.ShouldBe(35);
            });
        }
    }
}
