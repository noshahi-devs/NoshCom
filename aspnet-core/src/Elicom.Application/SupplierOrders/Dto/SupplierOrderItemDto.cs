using Abp.Application.Services.Dto;
using System;

namespace Elicom.SupplierOrders.Dto
{
    public class SupplierOrderItemDto : EntityDto<Guid>
    {
        public Guid SupplierOrderId { get; set; }
        public Guid ProductId { get; set; }
        public int Quantity { get; set; }
        public decimal PurchasePrice { get; set; }
        public string ProductName { get; set; }
    }
}
