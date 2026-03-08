using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using AutoMapper.Internal.Mappers;
using Elicom.Authorization;
using Elicom.Entities;
using Elicom.Products.Dto;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Elicom.Storage;

namespace Elicom.Products
{
    //[AbpAuthorize(PermissionNames.Pages_Products)]
    public class ProductAppService : ElicomAppServiceBase, IProductAppService
    {
        private readonly IRepository<Product, Guid> _productRepo;
        private readonly IBlobStorageService _blobStorageService;

        public ProductAppService(
            IRepository<Product, Guid> productRepo,
            IBlobStorageService blobStorageService)
        {
            _productRepo = productRepo;
            _blobStorageService = blobStorageService;
        }

        public async Task<ListResultDto<ProductDto>> GetAll()
        {
            using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant))
            {
                var products = await _productRepo
                    .GetAllIncluding(p => p.Category)
                    .ToListAsync();

                return new ListResultDto<ProductDto>(
                    ObjectMapper.Map<List<ProductDto>>(products)
                );
            }
        }

        public async Task<ListResultDto<ProductDto>> GetByCategory(Guid categoryId)
        {
            var products = await _productRepo
                .GetAllIncluding(p => p.Category)
                .Where(p => p.CategoryId == categoryId)
                .ToListAsync();

            return new ListResultDto<ProductDto>(
                ObjectMapper.Map<List<ProductDto>>(products)
            );
        }

        [HttpGet]
        public async Task<ListResultDto<ProductDto>> Search(string query)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return new ListResultDto<ProductDto>();
            }

            var lowercaseQuery = query.ToLower();

            // Ignore filters to see global wholesale products
            List<Product> products;
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                products = await _productRepo
                    .GetAllIncluding(p => p.Category)
                    .Where(p => p.Name.ToLower().Contains(lowercaseQuery) ||
                                (p.SKU != null && p.SKU.ToLower().Contains(lowercaseQuery)) ||
                                (p.Description != null && p.Description.ToLower().Contains(lowercaseQuery)))
                    .ToListAsync();
            }

            return new ListResultDto<ProductDto>(
                ObjectMapper.Map<List<ProductDto>>(products)
            );
        }

        [AbpAuthorize(PermissionNames.Pages_Products_Create)]
        public async Task<ProductDto> Create(CreateProductDto input)
        {
            NormalizeSupplierPricing(input);
            input.Images = await ProcessImages(input.Images, input.Name);
            var product = ObjectMapper.Map<Product>(input);
            product.TenantId = input.TenantId ?? AbpSession.TenantId; // Use DTO tenantId if provided
            
            await _productRepo.InsertAsync(product);
            return ObjectMapper.Map<ProductDto>(product);
        }

        [AbpAuthorize(PermissionNames.Pages_Products_Edit)]
        public async Task<ProductDto> Update(UpdateProductDto input)
        {
            NormalizeSupplierPricing(input);
            input.Images = await ProcessImages(input.Images, input.Name);
            var product = await _productRepo.GetAsync(input.Id);
            ObjectMapper.Map(input, product);
            
            // Ensure TenantId is preserved or updated from DTO
            if (input.TenantId.HasValue)
            {
                product.TenantId = input.TenantId;
            }
            else if (!product.TenantId.HasValue)
            {
                product.TenantId = AbpSession.TenantId;
            }

            return ObjectMapper.Map<ProductDto>(product);
        }

        private static void NormalizeSupplierPricing(CreateProductDto input)
        {
            input.ResellerMaxPrice = Math.Round(Math.Max(0m, input.ResellerMaxPrice), 2, MidpointRounding.AwayFromZero);
            input.DiscountPercentage = Math.Clamp(input.DiscountPercentage, 0m, 100m);
            input.SupplierPrice = CalculateDiscountedSupplierPrice(input.ResellerMaxPrice, input.DiscountPercentage);
        }

        private static void NormalizeSupplierPricing(UpdateProductDto input)
        {
            input.ResellerMaxPrice = Math.Round(Math.Max(0m, input.ResellerMaxPrice), 2, MidpointRounding.AwayFromZero);
            input.DiscountPercentage = Math.Clamp(input.DiscountPercentage, 0m, 100m);
            input.SupplierPrice = CalculateDiscountedSupplierPrice(input.ResellerMaxPrice, input.DiscountPercentage);
        }

        private static decimal CalculateDiscountedSupplierPrice(decimal resellerMaxPrice, decimal discountPercentage)
        {
            var discountedPrice = resellerMaxPrice - (resellerMaxPrice * discountPercentage / 100m);
            return Math.Round(Math.Max(discountedPrice, 0m), 2, MidpointRounding.AwayFromZero);
        }

        private async Task<string> ProcessImages(string imagesJson, string productName)
        {
            if (string.IsNullOrEmpty(imagesJson)) return imagesJson;

            List<string> images;
            bool isJsonArray = false;

            try
            {
                images = Newtonsoft.Json.JsonConvert.DeserializeObject<List<string>>(imagesJson);
                isJsonArray = images != null;
            }
            catch
            {
                // Not a JSON array, treat as a single string if it's base64 or a URL
                images = new List<string> { imagesJson };
            }

            if (images == null || images.Count == 0) return imagesJson;

            bool changed = false;
            var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
            var sanitizedName = SanitizeName(productName);

            for (int i = 0; i < images.Count; i++)
            {
                if (IsBase64(images[i]))
                {
                    try
                    {
                        var fileName = $"Product_{sanitizedName}_{timestamp}_{i}.png";
                        var url = await _blobStorageService.UploadImageAsync(images[i], fileName);
                        if (!string.IsNullOrEmpty(url))
                        {
                            images[i] = url;
                            changed = true;
                            Logger.Info($"[BlobStorage] Converted image {i} for {productName}");
                        }
                    }
                    catch (Exception ex)
                    {
                        Logger.Error($"[BlobStorage] Failed to convert image {i} for {productName}", ex);
                        // Continue to next image even if one fails
                    }
                }
            }

            if (changed)
            {
                // If it was originally a JSON array, return as JSON array
                // If it was a single string, return as JSON array anyway (standardizing)
                return Newtonsoft.Json.JsonConvert.SerializeObject(images);
            }

            return imagesJson;
        }

        private bool IsBase64(string base64String)
        {
            if (string.IsNullOrEmpty(base64String)) return false;
            return base64String.Contains("base64,") || base64String.Length > 1000;
        }

        private string SanitizeName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "Product";
            string sanitized = System.Text.RegularExpressions.Regex.Replace(name, @"[^a-zA-Z0-9_\-]", "");
            return !string.IsNullOrWhiteSpace(sanitized) ? sanitized : "Product";
        }

        [AbpAuthorize(PermissionNames.Pages_Products_Delete)]
        public async Task Delete(Guid id)
        {
            await _productRepo.DeleteAsync(id);
        }
    }

}
