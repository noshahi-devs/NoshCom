using Abp.Application.Services.Dto;
using System;
using System.Collections.Generic;

namespace Elicom.SupplierOrders.Dto
{
    public class SupplierOrderDto : EntityDto<Guid>
    {
        public string ReferenceCode { get; set; }
        public long ResellerId { get; set; }
        public long SupplierId { get; set; }
        public decimal TotalPurchaseAmount { get; set; }
        public DateTime CreationTime { get; set; }
        public string WarehouseAddress { get; set; }
        public string ShippingAddress { get; set; }
        public string CustomerName { get; set; }
        public string Status { get; set; }
        public string SellerName { get; set; }
        public long SellerId { get; set; }

        public DateTime? ShipmentDate { get; set; }
        public string CarrierId { get; set; }
        public string TrackingCode { get; set; }

        public Guid? OrderId { get; set; }

        public List<SupplierOrderItemDto> Items { get; set; }
    }
}
