using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Domain.Repositories;
using Abp.UI;
using Elicom.Entities;
using Elicom.Homepage.Dto;
using Microsoft.EntityFrameworkCore;
using System.Transactions;
using Abp.EntityFrameworkCore;
using Abp.Domain.Uow;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Elicom.EntityFrameworkCore;
using Abp.EntityFrameworkCore.Uow;

namespace Elicom.Homepage
{
    public class HomepageAppService : ApplicationService
    {
        private readonly IRepository<Product, Guid> _productRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;
        private readonly IRepository<Category, Guid> _categoryRepository;
        private readonly IRepository<Store, Guid> _storeRepository;


        public HomepageAppService(
            IRepository<Product, Guid> productRepository,
            IRepository<StoreProduct, Guid> storeProductRepository,
            IRepository<Category, Guid> categoryRepository,
            IRepository<Store, Guid> storeRepository)

        {
            _productRepository = productRepository;
            _storeProductRepository = storeProductRepository;
            _categoryRepository = categoryRepository;
            _storeRepository = storeRepository;

        }


        [UnitOfWork(TransactionScopeOption.Suppress)]
        public virtual async Task<PagedResultDto<ProductCardDto>> GetAllProductsForCards(
            GetProductsInput input)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                // 1️⃣ Base query: Get only active public listings
                var baseQuery = _storeProductRepository
                    .GetAllIncluding(sp => sp.Product, sp => sp.Store)
                    .Where(sp =>
                        sp.Status &&
                        sp.Product != null && sp.Product.Status &&
                        sp.Store != null && sp.Store.Status)
                    .AsQueryable();

                // 2️⃣ Filter by Search Term (SQL-translatable name/keyword matching)
                if (!string.IsNullOrWhiteSpace(input.SearchTerm))
                {
                    var rawTerm = input.SearchTerm.Trim();
                    var lowerTerm = rawTerm.ToLowerInvariant();
                    var keywords = rawTerm
                        .Split(new[] { ' ', ',', '-', '_' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(k => k.Trim().ToLowerInvariant())
                        .Where(k => k.Length > 0)
                        .Distinct()
                        .ToList();

                    var compactTerm = new string(lowerTerm.Where(char.IsLetterOrDigit).ToArray());

                    if (keywords.Any())
                    {
                        baseQuery = baseQuery.Where(sp =>
                            sp.Product != null && (
                                (sp.Product.Name != null && (
                                    sp.Product.Name.ToLower().Contains(lowerTerm) ||
                                    (!string.IsNullOrEmpty(compactTerm) &&
                                     sp.Product.Name.ToLower().Replace(" ", "").Replace("-", "").Replace("_", "").Contains(compactTerm))
                                )) ||
                                keywords.All(k =>
                                    (sp.Product.Name != null && (
                                        sp.Product.Name.ToLower().Contains(k) ||
                                        sp.Product.Name.ToLower().Replace(" ", "").Replace("-", "").Replace("_", "").Contains(k)
                                    )) ||
                                    (sp.Product.SKU != null && sp.Product.SKU.ToLower().Contains(k)) ||
                                    (sp.Product.Description != null && sp.Product.Description.ToLower().Contains(k)) ||
                                    (sp.Product.BrandName != null && sp.Product.BrandName.ToLower().Contains(k)) ||
                                    (sp.Store != null && sp.Store.Name != null && sp.Store.Name.ToLower().Contains(k))
                                )
                            )
                        );
                    }
                }

                // 3️⃣ Get the IDs of the best StoreProduct for each unique ProductId (the one with the lowest price)
                var bestStoreProductIdsQuery = baseQuery
                    .GroupBy(sp => sp.ProductId)
                    .Select(g => g.OrderBy(sp => sp.ResellerPrice).Select(sp => sp.Id).FirstOrDefault());

                // 4️⃣ Correct total count of unique products
                var totalCount = await bestStoreProductIdsQuery.CountAsync();

                // 5️⃣ Fetch paged listings using the best IDs
                var listings = await _storeProductRepository.GetAll()
                    .Where(sp => bestStoreProductIdsQuery.Contains(sp.Id))
                    .OrderByDescending(sp => sp.Product.CreatedAt)
                    .Skip(input.SkipCount)
                    .Take(input.MaxResultCount)
                    .Include(sp => sp.Product).ThenInclude(p => p.Category)
                    .Include(sp => sp.Store)
                    .ToListAsync();

                // 6️⃣ Map to ProductCardDto
                var items = listings.Select(sp =>
                {
                    var p = sp.Product;
                    var images = p.Images?.Split(',', StringSplitOptions.RemoveEmptyEntries);

                    var finalPrice = sp.ResellerPrice * (1 - sp.ResellerDiscountPercentage / 100m);

                    return new ProductCardDto
                    {
                        ProductId = p.Id,
                        StoreProductId = sp.Id,

                        CategoryId = p.CategoryId,
                        CategoryName = p.Category?.Name ?? "Uncategorized",

                        Title = p.Name,

                        Image1 = images?.FirstOrDefault(),
                        Image2 = images?.Skip(1).FirstOrDefault(),

                        OriginalPrice = sp.ResellerPrice,
                        ResellerDiscountPercentage = sp.ResellerDiscountPercentage,
                        Price = finalPrice,

                        StoreName = sp.Store?.Name ?? "Unknown Store",
                        Slug = p.Slug
                    };
                }).ToList();

                // 7️⃣ Return paged result
                return new PagedResultDto<ProductCardDto>(totalCount, items);
            }
        }

        public virtual async Task<ProductDetailDto> GetProductDetail(Guid productId, Guid? storeProductId = null)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var product = await _productRepository
                    .GetAll()
                    .Include(p => p.Category)
                    .Include(p => p.StoreProducts)
                        .ThenInclude(sp => sp.Store)
                    .FirstOrDefaultAsync(p => p.Id == productId);

                if (product == null)
                    throw new UserFriendlyException("Product not found.");

                // If storeProductId is not provided, take the first available listing
                var storeProduct = storeProductId.HasValue 
                    ? product.StoreProducts.FirstOrDefault(sp => sp.Id == storeProductId.Value)
                    : product.StoreProducts.FirstOrDefault();

                if (storeProduct == null)
                    throw new UserFriendlyException("Product is not available in any store.");

                // Other stores selling the same product
                var otherStores = product.StoreProducts
                    .Where(sp => sp.Id != storeProductId)
                    .Select(sp => new OtherStoreDto
                    {
                        StoreId = sp.StoreId,
                        StoreName = sp.Store.Name,
                        ResellerPrice = sp.ResellerPrice,
                        ResellerDiscountPercentage = sp.ResellerDiscountPercentage,
                        Price = sp.ResellerPrice * (1 - sp.ResellerDiscountPercentage / 100),
                        StockQuantity = sp.StockQuantity
                    })
                    .ToList();

                var images = product.Images?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
                var sizes = product.SizeOptions?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
                var colors = product.ColorOptions?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();

                return new ProductDetailDto
                {
                    ProductId = product.Id,
                    Title = product.Name,
                    Slug = product.Slug,
                    Description = product.Description,
                    BrandName = product.BrandName,
                    Images = images,
                    SizeOptions = sizes,
                    ColorOptions = colors,

                    Category = new CategoryInfoDto
                    {
                        CategoryId = product.CategoryId,
                        Name = product.Category?.Name ?? "Uncategorized",
                        Slug = product.Category?.Slug ?? "uncategorized"
                    },

                    Store = new StoreInfoDto
                    {
                        StoreId = storeProduct.StoreId,
                        StoreName = storeProduct.Store?.Name ?? "Unknown Store",
                        StoreDescription = storeProduct.Store?.Description,
                        StoreSlug = storeProduct.Store?.Slug,
                        ResellerPrice = storeProduct.ResellerPrice,
                        ResellerDiscountPercentage = storeProduct.ResellerDiscountPercentage,
                        Price = storeProduct.ResellerPrice * (1 - storeProduct.ResellerDiscountPercentage / 100),
                        StockQuantity = storeProduct.StockQuantity
                    },

                    OtherStores = otherStores,
                    TotalOtherStores = otherStores.Count
                };
            }
        }

        [UnitOfWork(TransactionScopeOption.Suppress)]
        public virtual async Task<List<HomepageCategoryDto>> GetCategoriesWithListedProducts()
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                // 1. Fetch all categories that have at least one listed product
                var query = _categoryRepository.GetAll()
                    .Where(c => c.Products.Any(p => p.Status && p.StoreProducts.Any(sp => sp.Status && sp.Store.Status)));

                var categories = await query.ToListAsync();

                var items = new List<HomepageCategoryDto>();

                foreach (var c in categories)
                {
                    // 2. Fetch first 4 product images for each category
                    var productImages = await _productRepository.GetAll()
                        .Where(p => p.CategoryId == c.Id && p.Status && p.StoreProducts.Any(sp => sp.Status && sp.Store.Status))
                        .OrderByDescending(p => p.CreatedAt)
                        .Select(p => p.Images)
                        .Take(4) // Fetch up to 4 products
                        .ToListAsync();

                    var previewImages = productImages
                        .SelectMany(img => (img ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries))
                        .Take(4) // We want 4 unique boxes
                        .ToList();

                    // 3. Count total products (can be optimized but okay for homepage)
                    var totalCount = await _productRepository.GetAll()
                        .CountAsync(p => p.CategoryId == c.Id && p.Status && p.StoreProducts.Any(sp => sp.Status && sp.Store.Status));

                    items.Add(new HomepageCategoryDto
                    {
                        CategoryId = c.Id,
                        Name = c.Name,
                        Slug = c.Slug,
                        ImageUrl = c.ImageUrl,
                        TotalProducts = totalCount,
                        PreviewImages = previewImages
                    });
                }

                return items;
            }
        }

        public virtual async Task<List<ProductCardDto>> GetProductListingsAcrossStores(Guid productId)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                // Fetch the product with its category
                var product = await _productRepository
                    .GetAll()
                    .Include(p => p.Category)
                    .FirstOrDefaultAsync(p => p.Id == productId);

                if (product == null)
                    throw new Abp.UI.UserFriendlyException("Product not found.");

                // Fetch all store listings for this product
                var storeProducts = await _storeProductRepository
                    .GetAll()
                    .Include(sp => sp.Store)
                    .Where(sp => sp.ProductId == productId && sp.Status && sp.Store.Status)
                    .ToListAsync();

                // Map each store product to ProductCardDto
                var productCards = storeProducts.Select(sp =>
                {
                    var images = product.Images?.Split(',', StringSplitOptions.RemoveEmptyEntries);

                    var finalPrice = sp.ResellerPrice * (1 - sp.ResellerDiscountPercentage / 100m);

                    return new ProductCardDto
                    {
                        ProductId = product.Id,
                        StoreProductId = sp.Id,
                        CategoryId = product.CategoryId,
                        CategoryName = product.Category.Name,

                        Title = product.Name,
                        Image1 = images?.FirstOrDefault(),
                        Image2 = images?.Skip(1).FirstOrDefault(),

                        OriginalPrice = sp.ResellerPrice,
                        ResellerDiscountPercentage = sp.ResellerDiscountPercentage,
                        Price = finalPrice,

                        StoreName = sp.Store.Name,
                        Slug = product.Slug
                    };
                }).ToList();

                return productCards;
            }
        }


        public virtual async Task<List<ProductCardDto>> GetProductsByStore(Guid storeId)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                // Fetch all store products for this store
                var storeProducts = await _storeProductRepository
                    .GetAll()
                    .Include(sp => sp.Product)
                        .ThenInclude(p => p.Category)
                    .Include(sp => sp.Store)
                    .Where(sp => sp.StoreId == storeId) // Removed strict status filters
                    .ToListAsync();

                // Map to ProductCardDto
                var products = storeProducts.Select(sp =>
                {
                    var product = sp.Product;
                    var images = product.Images?.Split(',', StringSplitOptions.RemoveEmptyEntries);

                    var finalPrice = sp.ResellerPrice * (1 - sp.ResellerDiscountPercentage / 100m);

                    return new ProductCardDto
                    {
                        ProductId = product.Id,
                        StoreProductId = sp.Id,
                        CategoryId = product.CategoryId,
                        CategoryName = product.Category.Name,

                        Title = product.Name,
                        Image1 = images?.FirstOrDefault(),
                        Image2 = images?.Skip(1).FirstOrDefault(),

                        OriginalPrice = sp.ResellerPrice,
                        ResellerDiscountPercentage = sp.ResellerDiscountPercentage,
                        Price = finalPrice,

                        StoreName = sp.Store.Name,
                        Slug = product.Slug
                    };
                }).ToList();

                return products;
            }
        }

        private static string NormalizeSearchTerm(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            return new string(value.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        }

        private static bool MatchesSearch(string value, string normalizedTerm)
        {
            if (string.IsNullOrWhiteSpace(value) || string.IsNullOrWhiteSpace(normalizedTerm))
            {
                return false;
            }

            return NormalizeSearchTerm(value).Contains(normalizedTerm);
        }

    }
}
