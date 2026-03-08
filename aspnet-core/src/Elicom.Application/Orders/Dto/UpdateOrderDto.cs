using Abp.Application.Services.Dto;
using System;

namespace Elicom.Orders.Dto
{
    public class UpdateOrderDto : EntityDto<Guid>
    {
        public string Status { get; set; }
        public string PaymentStatus { get; set; }
        public string DeliveryTrackingNumber { get; set; }
    }
}
