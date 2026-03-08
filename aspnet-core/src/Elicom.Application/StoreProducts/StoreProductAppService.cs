using System;
using System.Linq;
using System.Threading.Tasks;
using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Elicom.Authorization;
using Elicom.Entities;
using Elicom.StoreProducts.Dto;
using Microsoft.EntityFrameworkCore;

namespace Elicom.StoreProducts
{    

    public class StoreProductAppService : ElicomAppServiceBase, IStoreProductAppService
    {
        private readonly IRepository<StoreProduct, Guid> _storeProductRepo;

        public StoreProductAppService(IRepository<StoreProduct, Guid> storeProductRepo)
        {
            _storeProductRepo = storeProductRepo;
        }

        [AbpAuthorize(PermissionNames.Pages_StoreProducts_Create)]
        public async Task Create(CreateStoreProductDto input)
        {
            var entity = ObjectMapper.Map<StoreProduct>(input);
            await _storeProductRepo.InsertAsync(entity);
        }

        [AbpAuthorize(PermissionNames.Pages_StoreProducts_Create)]
        public async Task MapProductToStore(MapProductDto input)
        {
            // Check if already mapped
            var exists = await _storeProductRepo.GetAll()
                .AnyAsync(sp => sp.StoreId == input.StoreId && sp.ProductId == input.ProductId);

            if (exists)
            {
                throw new Abp.UI.UserFriendlyException("This product is already mapped to your store.");
            }

            var storeProduct = new StoreProduct
            {
                Id = Guid.NewGuid(),
                StoreId = input.StoreId,
                ProductId = input.ProductId,
                ResellerPrice = input.ResellerPrice,
                StockQuantity = input.StockQuantity,
                Status = input.Status
            };

            await _storeProductRepo.InsertAsync(storeProduct);
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Seller)]
        public async Task<ListResultDto<StoreProductDto>> GetByStore(Guid storeId)
        {
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant))
            {
                var list = await _storeProductRepo
                    .GetAllIncluding(sp => sp.Product)
                    .Where(sp => sp.StoreId == storeId && sp.Status)
                    .ToListAsync();

                return new ListResultDto<StoreProductDto>(
                    ObjectMapper.Map<System.Collections.Generic.List<StoreProductDto>>(list)
                );
            }
        }

        [AbpAuthorize(PermissionNames.Pages_StoreProducts_Edit)]
        public async Task Update(UpdateStoreProductDto input)
        {
            var entity = await _storeProductRepo.GetAsync(input.Id);
            ObjectMapper.Map(input, entity);
        }

        [AbpAuthorize(PermissionNames.Pages_StoreProducts_Delete)]
        public async Task Delete(Guid id)
        {
            await _storeProductRepo.DeleteAsync(id);
        }
    }

}
