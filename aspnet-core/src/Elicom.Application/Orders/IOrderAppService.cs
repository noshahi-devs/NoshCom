using Abp.Application.Services;
using Elicom.Orders.Dto;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Abp.Application.Services.Dto;

namespace Elicom.Orders
{
    public interface IOrderAppService : IApplicationService
    {
        Task<OrderDto> Create(CreateOrderDto input);
        Task<OrderDto> Get(Guid id);
        Task<List<OrderDto>> GetAll();
        Task<List<OrderDto>> GetAllForCustomer(long userId);
        Task<PagedResultDto<OrderListItemDto>> GetForCustomer(GetCustomerOrdersInput input);
        Task<List<OrderDto>> GetByStore(Guid storeId);

        Task<OrderDto> Fulfill(FulfillOrderDto input);
        Task<OrderDto> Verify(VerifyOrderDto input);
        Task<OrderDto> Deliver(VerifyOrderDto input);
        Task<OrderDto> Cancel(VerifyOrderDto input);
        Task<OrderDto> Reject(VerifyOrderDto input);
        Task<OrderDto> CreateManualOrder(CreateManualOrderDto input);
        Task<List<CarrierDto>> GetCarriers();
    }
}
