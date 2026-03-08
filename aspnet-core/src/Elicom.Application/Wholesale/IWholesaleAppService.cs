using Abp.Application.Services;
using Elicom.Wholesale.Dto;
using Elicom.SupplierOrders.Dto;
using System.Threading.Tasks;

namespace Elicom.Wholesale
{
    public interface IWholesaleAppService : IApplicationService
    {
        Task<SupplierOrderDto> PlaceWholesaleOrder(CreateWholesaleOrderInput input);
    }
}
