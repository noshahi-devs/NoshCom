using Abp.Application.Services.Dto;
using System;

namespace Elicom.Orders.Dto
{
    public class UpdateOrderShippingDto : EntityDto<Guid>
    {
        public Guid TrackingId { get; set; }
    }
}
