using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Domain.Repositories;
using Elicom.Categories.Dto;
using Elicom.Entities;
using Elicom.Products.Dto;
using Microsoft.EntityFrameworkCore;
using Abp.UI;
using Abp.Authorization;
using Abp.Domain.Uow;
using Elicom;
using Elicom.Authorization.Users;

namespace Elicom.Public
{
    [RemoteService]
    [AbpAllowAnonymous]
    public class PublicAppService : ElicomAppServiceBase, IPublicAppService
    {
        private readonly IRepository<Category, Guid> _categoryRepository;
        private readonly IRepository<Product, Guid> _productRepository;
        private readonly IRepository<User, long> _userRepository;

        public PublicAppService(
            IRepository<Category, Guid> categoryRepository,
            IRepository<Product, Guid> productRepository,
            IRepository<User, long> userRepository)
        {
            _categoryRepository = categoryRepository;
            _productRepository = productRepository;
            _userRepository = userRepository;
        }

        public async Task<ListResultDto<CategoryDto>> GetCategories(int maxResultCount = 100)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                Logger.Warn("GetCategories: Starting fetch...");
                // Fetch categories for the current tenant (or all if filtered)
                var categoriesQuery = _categoryRepository.GetAll();
                if (maxResultCount > 0)
                {
                    categoriesQuery = categoriesQuery.Take(maxResultCount);
                }
                var categories = await categoriesQuery.ToListAsync();
                Logger.Warn($"GetCategories: Fetched {categories.Count} categories.");
                
                // Optimized: Group and count products by CategoryId in the database
                var categoryIds = categories.Select(c => c.Id).ToList();
                var countDict = await _productRepository.GetAll()
                    .Where(p => categoryIds.Contains(p.CategoryId))
                    .GroupBy(p => p.CategoryId)
                    .Select(g => new { Id = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.Id, x => x.Count);

                var result = categories
                    .GroupBy(c => c.Name?.Trim().ToLower() ?? "uncategorized")
                    .Select(g =>
                    {
                        var groupName = g.Key;
                        var first = g.First();
                        var dto = ObjectMapper.Map<CategoryDto>(first);
                        
                        // Use Guid ID for dictionary lookup
                        dto.ProductCount = countDict.ContainsKey(first.Id) ? countDict[first.Id] : 0;
                        
                        // Ensure name is set correctly for display
                        if (string.IsNullOrEmpty(dto.Name)) dto.Name = first.Name ?? groupName;
                        
                        if (string.IsNullOrEmpty(dto.Slug) || dto.Slug == "string" || dto.Slug == "null")
                        {
                            dto.Slug = System.Text.RegularExpressions.Regex.Replace((first.Name ?? "category").ToLower(), @"[^a-z0-9]+", "-").Trim('-');
                        }
                        return dto;
                    })
                    .OrderBy(c => c.Name)
                    .ToList();

                return new ListResultDto<CategoryDto>(result);
            }
        }

        public async Task<ListResultDto<ProductDto>> GetProducts(string searchTerm = null, int skipCount = 0, int maxResultCount = 8)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var query = _productRepository.GetAll().Include(p => p.Category).AsQueryable();

                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    var terms = searchTerm.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    foreach (var term in terms)
                    {
                        query = query.Where(p =>
                            (p.Name != null && p.Name.ToLower().Contains(term)) ||
                            (p.Description != null && p.Description.ToLower().Contains(term)) ||
                            (p.SKU != null && p.SKU.ToLower().Contains(term)) ||
                            (p.Category != null && p.Category.Name != null && p.Category.Name.ToLower().Contains(term))
                        );
                    }
                }

                var products = await query.OrderByDescending(p => p.CreatedAt)
                                          .Skip(skipCount)
                                          .Take(maxResultCount > 0 ? maxResultCount : 8)
                                          .ToListAsync();
                
                return new ListResultDto<ProductDto>(ObjectMapper.Map<List<ProductDto>>(products));
            }
        }

        public async Task<ProductDto> GetProductBySlug(string slug)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var product = await _productRepository.GetAll()
                    .Include(p => p.Category)
                    .FirstOrDefaultAsync(p => p.Slug == slug);

                if (product == null)
                    throw new UserFriendlyException("Product not found");

                return ObjectMapper.Map<ProductDto>(product);
            }
        }

        public async Task<ProductDto> GetProductBySku(string sku)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var product = await _productRepository.GetAll()
                    .Include(p => p.Category)
                    .FirstOrDefaultAsync(p => p.SKU == sku || p.Name.Contains(sku));

                if (product == null)
                    throw new UserFriendlyException("Product not found");

                return ObjectMapper.Map<ProductDto>(product);
            }
        }

        public async Task<ProductDto> GetProductById(Guid productId)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var product = await _productRepository.GetAll()
                    .Include(p => p.Category)
                    .FirstOrDefaultAsync(p => p.Id == productId);

                if (product == null)
                    throw new UserFriendlyException("Product not found");

                return ObjectMapper.Map<ProductDto>(product);
            }
        }

        public async Task<List<ProductDto>> GetProductsBySearch(string term)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var products = await _productRepository.GetAll()
                    .Include(p => p.Category)
                    .Where(p => p.Name.Contains(term) || p.SKU.Contains(term))
                    .Take(10)
                    .ToListAsync();

                return ObjectMapper.Map<List<ProductDto>>(products);
            }
        }

        public async Task<List<ProductDto>> GetProductsByCategory(string categorySlug, string searchTerm = null, Guid? categoryId = null)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var query = _productRepository.GetAll().Include(p => p.Category).AsQueryable();

                if (categoryId.HasValue && categoryId != Guid.Empty)
                {
                    query = query.Where(p => p.CategoryId == categoryId.Value);
                }
                else if (!string.IsNullOrWhiteSpace(categorySlug))
                {
                    var searchPattern = categorySlug.Replace("-", " ").ToLower();

                    // Allow exact match OR partial name match to handle cases like "digital product" -> "Digital Products ALi Bhai"
                    query = query.Where(p =>
                        (p.Category != null && p.Category.Slug == categorySlug) ||
                        (p.Category != null && p.Category.Name != null && p.Category.Name.ToLower() == searchPattern) ||
                        (p.Category != null && p.Category.Name != null && p.Category.Name.ToLower().Contains(searchPattern))
                    );
                }
                // If categorySlug is empty, we simply don't filter by category, allowing search across all products.

                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    var terms = searchTerm.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    foreach (var term in terms)
                    {
                        query = query.Where(p =>
                            p.Name.ToLower().Contains(term) ||
                            (p.Description != null && p.Description.ToLower().Contains(term)) ||
                            (p.SKU != null && p.SKU.ToLower().Contains(term)) ||
                            (p.Category != null && p.Category.Name.ToLower().Contains(term))
                        );
                    }
                }

                var products = await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
                var dtos = ObjectMapper.Map<List<ProductDto>>(products);

                // Fetch tenant IDs for suppliers
                var supplierIds = dtos.Where(d => d.SupplierId.HasValue).Select(d => d.SupplierId.Value).Distinct().ToList();
                if (supplierIds.Any())
                {
                    using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
                    {
                        var suppliers = await _userRepository.GetAll()
                            .Where(u => supplierIds.Contains(u.Id))
                            .Select(u => new { u.Id, u.TenantId })
                            .ToListAsync();

                        var supplierDict = suppliers.ToDictionary(s => s.Id, s => s.TenantId);
                        foreach (var dto in dtos)
                        {
                            if (dto.SupplierId.HasValue && supplierDict.ContainsKey(dto.SupplierId.Value))
                            {
                                dto.SupplierTenantId = supplierDict[dto.SupplierId.Value];
                            }
                        }
                    }
                }

                return dtos;
            }
        }

        [Authorize]
        public async Task<object> GetProfile()
        {
            var userId = AbpSession.UserId;
            if (!userId.HasValue)
                throw new UserFriendlyException("User not found");

            var user = await _userRepository.GetAsync(userId.Value);
            return new
            {
                user.Name,
                user.Surname,
                user.EmailAddress,
                user.UserName,
                user.Id
            };
        }
    }

    public interface IPublicAppService : IApplicationService
    {
        Task<ListResultDto<CategoryDto>> GetCategories(int maxResultCount = 100);
        Task<ListResultDto<ProductDto>> GetProducts(string searchTerm = null, int skipCount = 0, int maxResultCount = 8);
        Task<ProductDto> GetProductBySlug(string slug);
        Task<ProductDto> GetProductBySku(string sku);
        Task<ProductDto> GetProductById(Guid productId);
        Task<List<ProductDto>> GetProductsBySearch(string term);
        Task<List<ProductDto>> GetProductsByCategory(string categorySlug, string searchTerm = null, Guid? categoryId = null);
        Task<object> GetProfile();
    }
}
