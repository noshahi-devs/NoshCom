using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.EntityFrameworkCore;
using AutoMapper;
using Elicom.Authorization;
using Elicom.Categories.Dto;
using Elicom.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Transactions;
using Elicom.EntityFrameworkCore;
using Abp.EntityFrameworkCore.Uow;
using Elicom.Storage;
using Abp.UI;
using Microsoft.EntityFrameworkCore;

namespace Elicom.Categories
{
    public class CategoryAppService : ApplicationService, ICategoryAppService
    {
        private readonly IRepository<Category, Guid> _categoryRepository;
        private readonly IRepository<Product, Guid> _productRepository;
        private readonly IMapper _mapper;
        private readonly IBlobStorageService _blobStorageService;

        public CategoryAppService(
            IRepository<Category, Guid> categoryRepository,
            IRepository<Product, Guid> productRepository,
            IMapper mapper,
            IBlobStorageService blobStorageService)
        {
            _categoryRepository = categoryRepository;
            _productRepository = productRepository;
            _mapper = mapper;
            _blobStorageService = blobStorageService;
        }

        [AbpAuthorize(PermissionNames.Pages_Categories)]
        public virtual async Task<CategoryDto> Get(Guid id)
        {
            var entity = await _categoryRepository.GetAsync(id);
            return _mapper.Map<CategoryDto>(entity);
        }

        [UnitOfWork(TransactionScopeOption.Suppress)]
        public virtual async Task<ListResultDto<CategoryDto>> GetAll(int maxResultCount = 100)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var query = _categoryRepository.GetAll();
                if (maxResultCount > 0)
                {
                    query = query.Take(maxResultCount);
                }

                var categories = await query.ToListAsync();
                return new ListResultDto<CategoryDto>(_mapper.Map<List<CategoryDto>>(categories));
            }
        }
        [AbpAuthorize(PermissionNames.Pages_Categories_Create)]
        public async Task<CategoryDto> Create(CreateCategoryDto input)
        {
            if (IsBase64(input.ImageUrl))
            {
                try
                {
                    var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
                    var sanitizedName = SanitizeName(input.Name);
                    var fileName = $"Category_{sanitizedName}_{timestamp}.png";
                    var url = await _blobStorageService.UploadImageAsync(input.ImageUrl, fileName);
                    if (!string.IsNullOrEmpty(url))
                    {
                        input.ImageUrl = url;
                    }
                }
                catch (Exception ex)
                {
                    Logger.Error($"[BlobStorage] Failed to convert category image for {input.Name}", ex);
                }
            }

            var entity = _mapper.Map<Category>(input);
            entity.TenantId = input.TenantId ?? AbpSession.TenantId;
            
            await _categoryRepository.InsertAsync(entity);
            return _mapper.Map<CategoryDto>(entity);
        }

        [AbpAuthorize(PermissionNames.Pages_Categories_Edit)]
        public async Task<CategoryDto> Update(UpdateCategoryDto input)
        {
            if (IsBase64(input.ImageUrl))
            {
                try
                {
                    var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
                    var sanitizedName = SanitizeName(input.Name);
                    var fileName = $"Category_{sanitizedName}_{timestamp}.png";
                    var url = await _blobStorageService.UploadImageAsync(input.ImageUrl, fileName);
                    if (!string.IsNullOrEmpty(url))
                    {
                        input.ImageUrl = url;
                    }
                }
                catch (Exception ex)
                {
                    Logger.Error($"[BlobStorage] Failed to convert category image for {input.Name}", ex);
                }
            }

            var entity = await _categoryRepository.GetAsync(input.Id);
            _mapper.Map(input, entity);
            
            if (input.TenantId.HasValue)
            {
                entity.TenantId = input.TenantId;
            }
            else if (!entity.TenantId.HasValue)
            {
                entity.TenantId = AbpSession.TenantId;
            }

            return _mapper.Map<CategoryDto>(entity);
        }

        private bool IsBase64(string base64String)
        {
            if (string.IsNullOrEmpty(base64String)) return false;
            return base64String.Contains("base64,") || base64String.Length > 1000;
        }

        private string SanitizeName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "Category";
            // Remove invalid chars
            string sanitized = System.Text.RegularExpressions.Regex.Replace(name, @"[^a-zA-Z0-9_\-]", "");
            return !string.IsNullOrWhiteSpace(sanitized) ? sanitized : "Category";
        }

        public virtual async Task<ListResultDto<CategoryLookupDto>> GetLookup()
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                // Optimization: Database-side grouping to avoid memory bottleneck
                // We project to a simplified structure first to avoid EF Core translation issues
                var categories = await _categoryRepository.GetAll()
                    .Where(c => c.Name != null)
                    .GroupBy(c => c.Name.Trim())
                    .Select(g => new { 
                        Name = g.Key, 
                        // Pick the first available entity for this name to get its properties
                        Entity = g.FirstOrDefault() 
                    })
                    .OrderBy(x => x.Name)
                    .ToListAsync();

                var result = categories
                    .Where(x => x.Entity != null)
                    .Select(x => {
                        var c = x.Entity;
                        var dto = _mapper.Map<CategoryLookupDto>(c);
                        // Fallback for missing or invalid slugs
                        if (string.IsNullOrEmpty(dto.Slug) || dto.Slug == "string" || dto.Slug == "null")
                        {
                            dto.Slug = System.Text.RegularExpressions.Regex.Replace(c.Name?.ToLower() ?? "category", @"[^a-z0-9]+", "-").Trim('-');
                        }
                        return dto;
                    })
                    .ToList();

                return new ListResultDto<CategoryLookupDto>(result);
            }
        }

        [AbpAuthorize(PermissionNames.Pages_Categories_Delete)]
        public async Task Delete(Guid id, bool forceDelete = false)
        {
            try
            {
                // Check if any products reference this category
                var productsCount = await _productRepository.CountAsync(p => p.CategoryId == id);
                
                if (productsCount > 0)
                {
                    if (!forceDelete)
                    {
                        throw new UserFriendlyException(
                            $"Cannot delete this category because it has {productsCount} product(s) associated with it. " +
                            "Please reassign or delete those products first."
                        );
                    }
                    
                    // Force delete: Delete all products in this category first
                    var products = await _productRepository.GetAllListAsync(p => p.CategoryId == id);
                    foreach (var product in products)
                    {
                        await _productRepository.DeleteAsync(product);
                    }
                    
                    Logger.Info($"Force deleted {productsCount} product(s) from category {id}");
                }
                
                await _categoryRepository.DeleteAsync(id);
            }
            catch (UserFriendlyException)
            {
                throw; // Re-throw user-friendly exceptions
            }
            catch (Exception ex)
            {
                Logger.Error("Error deleting category", ex);
                throw new UserFriendlyException("An error occurred while deleting the category. Please try again.");
            }
        }
    }
}
