using Abp.Application.Services;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Elicom.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Utils
{
    public class DataSeedingAppService : ElicomAppServiceBase
    {
        private readonly IRepository<Category, Guid> _categoryRepository;
        private readonly IRepository<Product, Guid> _productRepository;
        private readonly IRepository<Store, Guid> _storeRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;

        public DataSeedingAppService(
            IRepository<Category, Guid> categoryRepository,
            IRepository<Product, Guid> productRepository,
            IRepository<Store, Guid> storeRepository,
            IRepository<StoreProduct, Guid> storeProductRepository)
        {
            _categoryRepository = categoryRepository;
            _productRepository = productRepository;
            _storeRepository = storeRepository;
            _storeProductRepository = storeProductRepository;
        }

        [AbpAuthorize]
        public async Task SeedAllData()
        {
            // 1. Add 5 Categories
            var categories = new List<string> { "Electronics", "Fashion", "Home & Kitchen", "Beauty", "Sports" };
            var catEntities = new List<Category>();

            foreach (var catName in categories)
            {
                var cat = await _categoryRepository.FirstOrDefaultAsync(c => c.Name == catName);
                if (cat == null)
                {
                    cat = new Category { Name = catName, Status = true };
                    cat.Id = await _categoryRepository.InsertAndGetIdAsync(cat);
                }
                catEntities.Add(cat);
            }

            // 2. Add 4 Products for each Category (Total 20)
            var random = new Random();
            for (int i = 0; i < catEntities.Count; i++)
            {
                var cat = catEntities[i];
                for (int j = 1; j <= 4; j++)
                {
                    var prodName = $"{cat.Name} Product {j}";
                    var existingProd = await _productRepository.FirstOrDefaultAsync(p => p.Name == prodName);
                    if (existingProd == null)
                    {
                        var product = new Product
                        {
                            Name = prodName,
                            CategoryId = cat.Id,
                            Description = $"High quality {prodName} in the {cat.Name} category.",
                            SupplierPrice = random.Next(10, 100),
                            ResellerMaxPrice = 200,
                            StockQuantity = 100,
                            Status = true,
                            SupplierId = 1, // Default Admin
                            Images = "default_image.jpg",
                            Slug = prodName.ToLower().Replace(" ", "-")
                        };
                        await _productRepository.InsertAsync(product);
                    }
                }
            }

            // 3. Create 3 Stores
            var storeNames = new List<string> { "Premium Hub", "Smart Deals", "Fashion Express" };
            var storeEntities = new List<Store>();

            for (int i = 0; i < storeNames.Count; i++)
            {
                var name = storeNames[i];
                var existingStore = await _storeRepository.FirstOrDefaultAsync(s => s.Name == name);
                if (existingStore == null)
                {
                    var store = new Store
                    {
                        Name = name,
                        Slug = name.ToLower().Replace(" ", "-"),
                        Status = true,
                        OwnerId = 1 // Default Admin for testing
                    };
                    store.Id = await _storeRepository.InsertAndGetIdAsync(store);
                    storeEntities.Add(store);
                }
                else
                {
                    storeEntities.Add(existingStore);
                }
            }

            // 4. Add Products to Stores
            var allProducts = await _productRepository.GetAllListAsync();
            foreach (var store in storeEntities)
            {
                // Give each store 5 random products from the catalog
                var selectedProds = allProducts.OrderBy(x => Guid.NewGuid()).Take(5);
                foreach (var prod in selectedProds)
                {
                    var existingSP = await _storeProductRepository.FirstOrDefaultAsync(sp => sp.StoreId == store.Id && sp.ProductId == prod.Id);
                    if (existingSP == null)
                    {
                        await _storeProductRepository.InsertAsync(new StoreProduct
                        {
                            StoreId = store.Id,
                            ProductId = prod.Id,
                            ResellerPrice = prod.SupplierPrice + random.Next(5, 20),
                            StockQuantity = 50,
                            Status = true
                        });
                    }
                }
            }
        }
    }
}
