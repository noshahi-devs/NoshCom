using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Elicom.Entities;
using Elicom.Warehouses.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Warehouses
{
    public class WarehouseAppService : ElicomAppServiceBase, IWarehouseAppService
    {
        private readonly IRepository<Warehouse, Guid> _warehouseRepository;

        public WarehouseAppService(IRepository<Warehouse, Guid> warehouseRepository)
        {
            _warehouseRepository = warehouseRepository;
        }

        public async Task<WarehouseDto> Create(CreateWarehouseInput input)
        {
            var warehouse = ObjectMapper.Map<Warehouse>(input);
            await _warehouseRepository.InsertAsync(warehouse);
            return ObjectMapper.Map<WarehouseDto>(warehouse);
        }

        public async Task<WarehouseDto> Update(WarehouseDto input)
        {
            var warehouse = await _warehouseRepository.GetAsync(input.Id);
            ObjectMapper.Map(input, warehouse);
            await _warehouseRepository.UpdateAsync(warehouse);
            return ObjectMapper.Map<WarehouseDto>(warehouse);
        }

        public async Task Delete(Guid id)
        {
            await _warehouseRepository.DeleteAsync(id);
        }

        public async Task<List<WarehouseDto>> GetByStore(Guid storeId)
        {
            var warehouses = await _warehouseRepository.GetAll()
                .Where(w => w.StoreId == storeId)
                .ToListAsync();

            return ObjectMapper.Map<List<WarehouseDto>>(warehouses);
        }

        public async Task<WarehouseDto> Get(Guid id)
        {
            var warehouse = await _warehouseRepository.GetAsync(id);
            return ObjectMapper.Map<WarehouseDto>(warehouse);
        }
    }
}
