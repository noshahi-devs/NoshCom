using Elicom.ResellerMarketplace;
using Elicom.Products.Dto;
using Elicom.SupplierProducts;
using Shouldly;
using System;
using System.Threading.Tasks;
using Xunit;
using System.Linq;
using Elicom.Entities;

namespace Elicom.Tests.ResellerMarketplace
{
    public class ResellerMarketplaceAppService_Tests : ElicomTestBase
    {
        private readonly IResellerMarketplaceAppService _resellerMarketplaceAppService;
        private readonly ISupplierProductAppService _supplierProductAppService;

        public ResellerMarketplaceAppService_Tests()
        {
            _resellerMarketplaceAppService = Resolve<IResellerMarketplaceAppService>();
            _supplierProductAppService = Resolve<ISupplierProductAppService>();
        }

        [Fact]
        public async Task Should_Show_Supplier_Products_In_Marketplace()
        {
             var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            
            using (var uow = uowManager.Begin())
            {
                // 1. Create a supplier product
                LoginAsDefaultTenantAdmin();
                
                var category = UsingDbContext(context => context.Categories.FirstOrDefault()) ??
                               UsingDbContext(context => {
                                   var c = new Category { Name = "Cat1", Slug = "cat1", Status = true };
                                   context.Categories.Add(c);
                                   context.SaveChanges();
                                   return c;
                               });

                await _supplierProductAppService.CreateProduct(new CreateProductDto
                {
                    Name = "Marketplace Product",
                    CategoryId = category.Id,
                    SupplierPrice = 100,
                    ResellerMaxPrice = 150,
                    StockQuantity = 50,
                    Status = true
                });

                await uowManager.Current.SaveChangesAsync();

                // 2. View in Marketplace
                var marketplaceProducts = await _resellerMarketplaceAppService.GetAvailableProducts();
                
                marketplaceProducts.Items.Any(p => p.Name == "Marketplace Product").ShouldBeTrue();
                
                await uow.CompleteAsync();
            }
        }

        [Fact]
        public async Task Should_Add_Product_To_Store()
        {
             var uowManager = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>();
            
            using (var uow = uowManager.Begin())
            {
                LoginAsDefaultTenantAdmin();
                var user = await GetCurrentUserAsync();

                // Ensure Store exists for Reseller
                UsingDbContext(context => {
                    if (!context.Stores.Any(s => s.OwnerId == user.Id))
                    {
                        context.Stores.Add(new Store { Name = "Reseller Store", OwnerId = user.Id, Status = true, Slug = "reseller-store" });
                        context.SaveChanges();
                    }
                });

                var category = UsingDbContext(context => context.Categories.FirstOrDefault()) ??
                               UsingDbContext(context => {
                                   var c = new Category { Name = "Cat1", Slug = "cat1", Status = true };
                                   context.Categories.Add(c);
                                   context.SaveChanges();
                                   return c;
                               });
                
                var productDto = await _supplierProductAppService.CreateProduct(new CreateProductDto
                {
                    Name = "Product To Add",
                    CategoryId = category.Id,
                    SupplierPrice = 100,
                    ResellerMaxPrice = 200,
                    StockQuantity = 10,
                    Status = true
                });

                await uowManager.Current.SaveChangesAsync();

                // Act: Add to store
                await _resellerMarketplaceAppService.AddToStore(productDto.Id, 150);
                await uowManager.Current.SaveChangesAsync();

                // Assert
                var storeProduct = UsingDbContext(context => context.StoreProducts.FirstOrDefault(sp => sp.ProductId == productDto.Id));
                storeProduct.ShouldNotBeNull();
                storeProduct.ResellerPrice.ShouldBe(150);

                await uow.CompleteAsync();
            }
        }
    }
}
