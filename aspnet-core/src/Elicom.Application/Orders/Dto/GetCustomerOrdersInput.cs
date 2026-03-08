using Abp.Application.Services.Dto;

namespace Elicom.Orders.Dto
{
    public class GetCustomerOrdersInput : PagedResultRequestDto
    {
        public string Status { get; set; }
    }
}
