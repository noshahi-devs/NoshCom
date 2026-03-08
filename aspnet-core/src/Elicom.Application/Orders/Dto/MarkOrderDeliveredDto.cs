using Abp.Application.Services.Dto;
using System;

namespace Elicom.Orders.Dto
{
    public class MarkOrderDeliveredDto : EntityDto<Guid>
    {
        public string DeliveryTrackingNumber { get; set; }
    }
}
