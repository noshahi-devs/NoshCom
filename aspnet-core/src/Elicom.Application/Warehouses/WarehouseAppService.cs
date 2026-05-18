using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.UI;
using Elicom.Authorization;
using Elicom.Entities;
using Elicom.Warehouses.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Warehouses
{
    [AbpAuthorize]
    public class WarehouseAppService : ElicomAppServiceBase, IWarehouseAppService
    {
        private readonly IRepository<Warehouse, Guid> _warehouseRepository;
        private readonly IRepository<Store, Guid> _storeRepository;

        public WarehouseAppService(
            IRepository<Warehouse, Guid> warehouseRepository,
            IRepository<Store, Guid> storeRepository)
        {
            _warehouseRepository = warehouseRepository;
            _storeRepository = storeRepository;
        }

        public async Task<WarehouseDto> Create(CreateWarehouseInput input)
        {
            await EnsureCanAccessStoreAsync(input.StoreId);
            var warehouse = ObjectMapper.Map<Warehouse>(input);
            await _warehouseRepository.InsertAsync(warehouse);
            return ObjectMapper.Map<WarehouseDto>(warehouse);
        }

        public async Task<WarehouseDto> Update(WarehouseDto input)
        {
            var warehouse = await _warehouseRepository.GetAsync(input.Id);
            await EnsureCanAccessStoreAsync(warehouse.StoreId);
            if (input.StoreId != Guid.Empty && input.StoreId != warehouse.StoreId)
            {
                await EnsureCanAccessStoreAsync(input.StoreId);
            }
            ObjectMapper.Map(input, warehouse);
            await _warehouseRepository.UpdateAsync(warehouse);
            return ObjectMapper.Map<WarehouseDto>(warehouse);
        }

        public async Task Delete(Guid id)
        {
            var warehouse = await _warehouseRepository.GetAsync(id);
            await EnsureCanAccessStoreAsync(warehouse.StoreId);
            await _warehouseRepository.DeleteAsync(id);
        }

        public async Task<List<WarehouseDto>> GetByStore(Guid storeId)
        {
            await EnsureCanAccessStoreAsync(storeId);
            var warehouses = await _warehouseRepository.GetAll()
                .Where(w => w.StoreId == storeId)
                .ToListAsync();

            return ObjectMapper.Map<List<WarehouseDto>>(warehouses);
        }

        public async Task<WarehouseDto> Get(Guid id)
        {
            var warehouse = await _warehouseRepository.GetAsync(id);
            await EnsureCanAccessStoreAsync(warehouse.StoreId);
            return ObjectMapper.Map<WarehouseDto>(warehouse);
        }

        private async Task EnsureCanAccessStoreAsync(Guid storeId)
        {
            if (await IsCurrentUserAdminAsync())
            {
                return;
            }

            var userId = AbpSession.UserId;
            if (!userId.HasValue)
            {
                throw new UserFriendlyException("Please sign in again.");
            }

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var canAccess = await _storeRepository.GetAll()
                    .AnyAsync(s => s.Id == storeId && s.OwnerId == userId.Value);

                if (!canAccess)
                {
                    throw new UserFriendlyException("Unauthorized access to this store warehouse.");
                }
            }
        }

        private async Task<bool> IsCurrentUserAdminAsync()
        {
            return await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_SmartStore_Admin)
                || await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_PrimeShip_Admin)
                || await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_Users)
                || await PermissionChecker.IsGrantedAsync(PermissionNames.Admin);
        }
    }
}
