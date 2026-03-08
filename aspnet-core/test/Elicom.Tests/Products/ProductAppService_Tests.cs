using Abp.Application.Services.Dto;
using Elicom.Categories;
using Elicom.Categories.Dto;
using Elicom.Products;
using Elicom.Products.Dto;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Elicom.Tests.Products
{
    public class ProductAppService_Tests : ElicomTestBase
    {
        private readonly IProductAppService _productAppService;
        private readonly ICategoryAppService _categoryAppService;

        public ProductAppService_Tests()
        {
            _productAppService = Resolve<IProductAppService>();
            _categoryAppService = Resolve<ICategoryAppService>();
        }

        private async Task<Guid> CreateTestCategory(string name = "Test Category")
        {
            var category = await _categoryAppService.Create(new CreateCategoryDto
            {
                Name = name,
                Slug = name.ToLower().Replace(" ", "-"),
                Status = true
            });
            return category.Id;
        }

        [Fact]
        public async Task Should_Create_Product()
        {
            // Arrange
            var categoryId = await CreateTestCategory("Electronics");

            var input = new CreateProductDto
            {
                Name = "iPhone 15 Pro",
                CategoryId = categoryId,
                Description = "Latest iPhone with advanced features",
                Images = "[\"https://example.com/iphone1.jpg\"]",
                SupplierPrice = 999.99m,
                ResellerMaxPrice = 1199.99m,
                StockQuantity = 100,
                SKU = "IPH15PRO",
                BrandName = "Apple",
                Slug = "iphone-15-pro",
                Status = true
            };

            // Act
            var result = await _productAppService.Create(input);

            // Assert
            result.ShouldNotBeNull();
            result.Id.ShouldNotBe(Guid.Empty);
            result.Name.ShouldBe("iPhone 15 Pro");
            result.CategoryId.ShouldBe(categoryId);
            result.SupplierPrice.ShouldBe(999.99m);
            result.SKU.ShouldBe("IPH15PRO");
        }

        [Fact]
        public async Task Should_Get_All_Products()
        {
            // Arrange
            var categoryId = await CreateTestCategory("Electronics");

            await _productAppService.Create(new CreateProductDto
            {
                Name = "MacBook Pro",
                CategoryId = categoryId,
                SupplierPrice = 1999.99m,
                ResellerMaxPrice = 2299.99m,
                StockQuantity = 50,
                SKU = "MBP16",
                Status = true
            });

            await _productAppService.Create(new CreateProductDto
            {
                Name = "iPad Air",
                CategoryId = categoryId,
                SupplierPrice = 599.99m,
                ResellerMaxPrice = 699.99m,
                StockQuantity = 75,
                SKU = "IPADAIR",
                Status = true
            });

            // Act
            var result = await _productAppService.GetAll();

            // Assert
            result.ShouldNotBeNull();
            result.Items.Count.ShouldBeGreaterThanOrEqualTo(2);
            result.Items.ShouldContain(p => p.Name == "MacBook Pro");
            result.Items.ShouldContain(p => p.Name == "iPad Air");
        }

        [Fact]
        public async Task Should_Get_Products_By_Category()
        {
            // Arrange
            var electronicsId = await CreateTestCategory("Electronics");
            var fashionId = await CreateTestCategory("Fashion");

            await _productAppService.Create(new CreateProductDto
            {
                Name = "Laptop",
                CategoryId = electronicsId,
                SupplierPrice = 899.99m,
                ResellerMaxPrice = 1099.99m,
                StockQuantity = 30,
                SKU = "LAPTOP01",
                Status = true
            });

            await _productAppService.Create(new CreateProductDto
            {
                Name = "T-Shirt",
                CategoryId = fashionId,
                SupplierPrice = 19.99m,
                ResellerMaxPrice = 29.99m,
                StockQuantity = 200,
                SKU = "TSHIRT01",
                Status = true
            });

            // Act
            var electronicsProducts = await _productAppService.GetByCategory(electronicsId);

            // Assert
            electronicsProducts.ShouldNotBeNull();
            electronicsProducts.Items.ShouldAllBe(p => p.CategoryId == electronicsId);
            electronicsProducts.Items.ShouldContain(p => p.Name == "Laptop");
            electronicsProducts.Items.ShouldNotContain(p => p.Name == "T-Shirt");
        }

        [Fact]
        public async Task Should_Update_Product()
        {
            // Arrange
            var categoryId = await CreateTestCategory("Electronics");

            var created = await _productAppService.Create(new CreateProductDto
            {
                Name = "Samsung Galaxy S23",
                CategoryId = categoryId,
                SupplierPrice = 799.99m,
                ResellerMaxPrice = 949.99m,
                StockQuantity = 60,
                SKU = "SAMS23",
                Status = true
            });

            var updateInput = new UpdateProductDto
            {
                Id = created.Id,
                Name = "Samsung Galaxy S23 Ultra",
                CategoryId = categoryId,
                Description = "Premium flagship smartphone",
                SupplierPrice = 1099.99m,
                ResellerMaxPrice = 1299.99m,
                StockQuantity = 40,
                SKU = "SAMS23ULTRA",
                BrandName = "Samsung",
                Status = true
            };

            // Act
            var result = await _productAppService.Update(updateInput);

            // Assert
            result.ShouldNotBeNull();
            result.Id.ShouldBe(created.Id);
            result.Name.ShouldBe("Samsung Galaxy S23 Ultra");
            result.SupplierPrice.ShouldBe(1099.99m);
            result.SKU.ShouldBe("SAMS23ULTRA");
        }

        [Fact]
        public async Task Should_Delete_Product()
        {
            // Arrange
            var categoryId = await CreateTestCategory("Electronics");

            var created = await _productAppService.Create(new CreateProductDto
            {
                Name = "Test Product",
                CategoryId = categoryId,
                SupplierPrice = 99.99m,
                ResellerMaxPrice = 129.99m,
                StockQuantity = 10,
                SKU = "TEST01",
                Status = true
            });

            // Act
            await _productAppService.Delete(created.Id);

            // Assert
            var allProducts = await _productAppService.GetAll();
            allProducts.Items.ShouldNotContain(p => p.Id == created.Id);
        }

        [Fact]
        public async Task Should_Create_Product_With_All_Fields()
        {
            // Arrange
            var categoryId = await CreateTestCategory("Fashion");

            var input = new CreateProductDto
            {
                Name = "Nike Air Max",
                CategoryId = categoryId,
                Description = "Comfortable running shoes",
                Images = "[\"https://example.com/nike1.jpg\",\"https://example.com/nike2.jpg\"]",
                SizeOptions = "[\"8\",\"9\",\"10\",\"11\"]",
                ColorOptions = "[\"Black\",\"White\",\"Red\"]",
                DiscountPercentage = 15.0m,
                SupplierPrice = 89.99m,
                ResellerMaxPrice = 129.99m,
                StockQuantity = 150,
                SKU = "NIKEAM01",
                BrandName = "Nike",
                Slug = "nike-air-max",
                Status = true
            };

            // Act
            var result = await _productAppService.Create(input);

            // Assert
            result.ShouldNotBeNull();
            result.Name.ShouldBe("Nike Air Max");
            result.Description.ShouldBe("Comfortable running shoes");
            result.BrandName.ShouldBe("Nike");
            result.DiscountPercentage.ShouldBe(15.0m);
            result.StockQuantity.ShouldBe(150);
            result.Status.ShouldBeTrue();
        }

        [Fact]
        public async Task Should_Include_Category_Name_In_Product()
        {
            // Arrange
            var category = await _categoryAppService.Create(new CreateCategoryDto
            {
                Name = "Smartphones",
                Slug = "smartphones",
                Status = true
            });

            var product = await _productAppService.Create(new CreateProductDto
            {
                Name = "Google Pixel 8",
                CategoryId = category.Id,
                SupplierPrice = 699.99m,
                ResellerMaxPrice = 799.99m,
                StockQuantity = 45,
                SKU = "PIXEL8",
                Status = true
            });

            // Act
            var result = await _productAppService.GetAll();

            // Assert
            var createdProduct = result.Items.FirstOrDefault(p => p.Id == product.Id);
            createdProduct.ShouldNotBeNull();
            createdProduct.CategoryName.ShouldBe("Smartphones");
        }
    }
}
