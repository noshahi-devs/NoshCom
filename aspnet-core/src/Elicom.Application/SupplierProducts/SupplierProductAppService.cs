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

namespace Elicom.SupplierProducts
{
    [AbpAuthorize(PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_SmartStore_Admin)]
    public class SupplierProductAppService : ElicomAppServiceBase, ISupplierProductAppService
    {
        private readonly IRepository<Product, Guid> _productRepository;

        public SupplierProductAppService(IRepository<Product, Guid> productRepository)
        {
            _productRepository = productRepository;
        }

        public async Task<ListResultDto<ProductDto>> GetMyProducts()
        {
            var user = await GetCurrentUserAsync();
            
            var products = await _productRepository.GetAll()
                .Include(p => p.Category)
                .Where(p => p.SupplierId == user.Id)
                .ToListAsync();

            return new ListResultDto<ProductDto>(ObjectMapper.Map<List<ProductDto>>(products));
        }

        public async Task<ProductDto> GetProductForEdit(Guid id)
        {
             var user = await GetCurrentUserAsync();
             var product = await _productRepository.FirstOrDefaultAsync(p => p.Id == id && p.SupplierId == user.Id);
             
             if (product == null)
             {
                 throw new UserFriendlyException("Product not found or access denied.");
             }

             return ObjectMapper.Map<ProductDto>(product);
        }

        public async Task<ProductDto> CreateProduct(CreateProductDto input)
        {
            var user = await GetCurrentUserAsync();

            var product = ObjectMapper.Map<Product>(input);
            product.SupplierId = user.Id;
            product.Status = true; // Default to active? Or as per input.
            product.TenantId = input.TenantId ?? AbpSession.TenantId;

            await _productRepository.InsertAsync(product);

            return ObjectMapper.Map<ProductDto>(product);
        }

        public async Task<ProductDto> UpdateProduct(UpdateProductDto input)
        {
            var user = await GetCurrentUserAsync();
            var product = await _productRepository.FirstOrDefaultAsync(p => p.Id == input.Id && p.SupplierId == user.Id);

            if (product == null)
            {
                throw new UserFriendlyException("Product not found or access denied.");
            }

            ObjectMapper.Map(input, product);
            // SupplierId remains unchanged automatically unless mapped (it shouldn't be in Update DTO)
            
            return ObjectMapper.Map<ProductDto>(product);
        }

        public async Task DeleteProduct(Guid id)
        {
            var user = await GetCurrentUserAsync();
            var product = await _productRepository.FirstOrDefaultAsync(p => p.Id == id && p.SupplierId == user.Id);

            if (product == null)
            {
                 throw new UserFriendlyException("Product not found or access denied.");
            }

            await _productRepository.DeleteAsync(product);
        }
    }
}
