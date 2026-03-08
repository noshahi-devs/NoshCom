using Abp.Application.Services.Dto;
using System;

namespace Elicom.Orders.Dto
{
    public class UpdateOrderStatusDto : EntityDto<Guid>
    {
        public string Status { get; set; }
        public string DeliveryTrackingNumber { get; set; }
    }
}
