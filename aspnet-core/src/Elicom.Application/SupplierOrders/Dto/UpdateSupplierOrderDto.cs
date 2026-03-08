using Abp.Application.Services.Dto;
using System;

namespace Elicom.SupplierOrders.Dto
{
    public class UpdateSupplierOrderDto : EntityDto<Guid>
    {
        public string Status { get; set; } // For updating to Delivered / Refunded
        public string PurchaseId { get; set; } // Optional update
    }
}
