using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Orders.Dto;
using Elicom.SupplierOrders.Dto;
using System;
using System.Threading.Tasks;

namespace Elicom.SupplierOrders
{
    public interface ISupplierOrderAppService : IApplicationService
    {
        Task<ListResultDto<SupplierOrderDto>> GetMyOrders();
        Task<SupplierOrderDto> Create(CreateSupplierOrderDto input);
        Task<SupplierOrderDto> Get(Guid id);
        Task MarkAsShipped(FulfillOrderDto input);
        Task MarkAsDelivered(Guid id);
        Task<SupplierOrderDto> MarkAsVerified(Guid id);
        Task<ListResultDto<SupplierOrderDto>> GetAll();
        Task<SupplierOrderDto> UpdateStatus(UpdateOrderStatusDto input);
    }
}
