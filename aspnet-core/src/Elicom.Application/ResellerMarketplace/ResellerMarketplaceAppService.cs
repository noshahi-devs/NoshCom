using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Elicom.Authorization;
using Elicom.Entities;
using Elicom.Products.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.ResellerMarketplace
{
    [AbpAuthorize(PermissionNames.Pages_PrimeShip)]
    public class ResellerMarketplaceAppService : ElicomAppServiceBase, IResellerMarketplaceAppService
    {
        private readonly IRepository<Product, Guid> _productRepository;
        private readonly IRepository<Store, Guid> _storeRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;

        public ResellerMarketplaceAppService(
            IRepository<Product, Guid> productRepository,
            IRepository<Store, Guid> storeRepository,
            IRepository<StoreProduct, Guid> storeProductRepository)
        {
            _productRepository = productRepository;
            _storeRepository = storeRepository;
            _storeProductRepository = storeProductRepository;
        }

        public async Task<ListResultDto<ProductDto>> GetAvailableProducts()
        {
            // Resellers can see all active products from any supplier
            var products = await _productRepository.GetAll()
                .Include(p => p.Category)
                .Where(p => p.Status && p.StockQuantity > 0)
                .ToListAsync();

            return new ListResultDto<ProductDto>(ObjectMapper.Map<List<ProductDto>>(products));
        }

        public async Task<ProductDto> GetProductDetails(Guid productId)
        {
            var product = await _productRepository.GetAll()
                .Include(p => p.Category)
                .FirstOrDefaultAsync(p => p.Id == productId);

            if (product == null)
            {
                throw new UserFriendlyException("Product not found");
            }

            return ObjectMapper.Map<ProductDto>(product);
        }

        public async Task AddToStore(Guid productId, decimal resellerPrice)
        {
            var user = await GetCurrentUserAsync();
            var product = await _productRepository.GetAsync(productId);
            var supplierPriceFloor = ResolveSupplierPrice(product);

            // Validate price
            if (resellerPrice > product.ResellerMaxPrice)
            {
                throw new UserFriendlyException($"Price cannot exceed the Supplier's Max Price of {product.ResellerMaxPrice}");
            }
            
            if (resellerPrice < supplierPriceFloor)
            {
                throw new UserFriendlyException($"Price cannot be lower than the Supplier's Price of {supplierPriceFloor}");
            }

            // Get Reseller's store (assuming one store for now)
            var store = await _storeRepository.FirstOrDefaultAsync(s => s.OwnerId == user.Id);
            if (store == null)
            {
                // Auto-create a store if not exists for the reseller?
                // For now, throw error as store setup should be a separate step.
                throw new UserFriendlyException("You do not have a store set up. Please create a store first.");
            }

            // Check if already added
            var exists = await _storeProductRepository.GetAll()
                .AnyAsync(sp => sp.StoreId == store.Id && sp.ProductId == productId);
            
            if (exists)
            {
                throw new UserFriendlyException("Product is already in your store.");
            }

            await _storeProductRepository.InsertAsync(new StoreProduct
            {
                StoreId = store.Id,
                ProductId = productId,
                ResellerPrice = resellerPrice,
                Status = true,
                StockQuantity = product.StockQuantity // Mirror supplier stock initially
            });
        }

        private static decimal ResolveSupplierPrice(Product product)
        {
            var resellerMaxPrice = Math.Max(0m, product.ResellerMaxPrice);
            var discountPercentage = Math.Clamp(product.DiscountPercentage, 0m, 100m);
            var discounted = resellerMaxPrice - (resellerMaxPrice * discountPercentage / 100m);

            if (discounted > 0m || resellerMaxPrice > 0m)
            {
                return Math.Round(Math.Max(discounted, 0m), 2, MidpointRounding.AwayFromZero);
            }

            return Math.Round(Math.Max(product.SupplierPrice, 0m), 2, MidpointRounding.AwayFromZero);
        }
    }
}
