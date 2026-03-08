using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Domain.Repositories;
using Elicom.Entities;
using Elicom.SmartStore.Dto;
using Abp.Domain.Uow;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.SmartStore
{
    public interface ISmartStorePublicAppService : IApplicationService
    {
        Task<ListResultDto<MarketplaceProductDto>> GetGlobalMarketplaceProducts();
        Task<ListResultDto<MarketplaceProductDto>> GetProductsByStore(string storeSlug);
    }

    public class SmartStorePublicAppService : ElicomAppServiceBase, ISmartStorePublicAppService
    {
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;

        public SmartStorePublicAppService(IRepository<StoreProduct, Guid> storeProductRepository)
        {
            _storeProductRepository = storeProductRepository;
        }

        public async Task<ListResultDto<MarketplaceProductDto>> GetGlobalMarketplaceProducts()
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var products = await _storeProductRepository.GetAll()
                    .Include(sp => sp.Store)
                    .Include(sp => sp.Product)
                        .ThenInclude(p => p.Category)
                    .Where(sp => sp.Status && sp.Store.Status && sp.Product.Status)
                    .ToListAsync();

                return new ListResultDto<MarketplaceProductDto>(
                    products.Select(sp => new MarketplaceProductDto
                    {
                        Id = sp.Id,
                        StoreName = sp.Store.Name,
                        StoreSlug = sp.Store.Slug,
                        ProductName = sp.Product.Name,
                        ProductImage = sp.Product.Images,
                        BrandName = sp.Product.BrandName,
                        Price = sp.ResellerPrice,
                        StockQuantity = sp.StockQuantity,
                        CategoryName = sp.Product.Category?.Name,
                        ProductId = sp.ProductId
                    }).ToList()
                );
            }
        }

        public async Task<ListResultDto<MarketplaceProductDto>> GetProductsByStore(string storeSlug)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var products = await _storeProductRepository.GetAll()
                    .Include(sp => sp.Store)
                    .Include(sp => sp.Product)
                        .ThenInclude(p => p.Category)
                    .Where(sp => sp.Store.Slug == storeSlug && sp.Status && sp.Product.Status && sp.Store.Status)
                    .ToListAsync();

                return new ListResultDto<MarketplaceProductDto>(
                    products.Select(sp => new MarketplaceProductDto
                    {
                        Id = sp.Id,
                        StoreName = sp.Store.Name,
                        StoreSlug = sp.Store.Slug,
                        ProductName = sp.Product.Name,
                        ProductImage = sp.Product.Images,
                        BrandName = sp.Product.BrandName,
                        Price = sp.ResellerPrice,
                        StockQuantity = sp.StockQuantity,
                        CategoryName = sp.Product.Category?.Name,
                        ProductId = sp.ProductId
                    }).ToList()
                );
            }
        }
    }
}
