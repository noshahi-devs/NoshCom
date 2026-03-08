using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Warehouses.Dto;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Elicom.Warehouses
{
    public interface IWarehouseAppService : IApplicationService
    {
        Task<WarehouseDto> Create(CreateWarehouseInput input);
        Task<WarehouseDto> Update(WarehouseDto input);
        Task Delete(Guid id);
        Task<List<WarehouseDto>> GetByStore(Guid storeId);
        Task<WarehouseDto> Get(Guid id);
    }
}
