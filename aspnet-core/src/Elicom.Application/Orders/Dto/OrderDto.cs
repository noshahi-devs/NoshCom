using Abp.Application.Services.Dto;
using System;
using System.Collections.Generic;
using Elicom.OrderItems.Dto;

namespace Elicom.Orders.Dto
{
    public class OrderDto : EntityDto<Guid>
    {
        public long UserId { get; set; }
        public string SourcePlatform { get; set; }
        public string OrderNumber { get; set; }
        public DateTime CreationTime { get; set; }
        public DateTime? LastModificationTime { get; set; }
        public string Status { get; set; }
        public string PaymentStatus { get; set; }
        public string PaymentMethod { get; set; }

        public decimal SubTotal { get; set; }
        public decimal ShippingCost { get; set; }
        public decimal Discount { get; set; }
        public decimal TotalAmount { get; set; }

        public string ShippingAddress { get; set; }
        public string Country { get; set; }
        public string State { get; set; }
        public string City { get; set; }
        public string PostalCode { get; set; }
        public string RecipientName { get; set; }
        public string RecipientPhone { get; set; }
        public string RecipientEmail { get; set; }

        public string SupplierReference { get; set; }
        public string DeliveryTrackingNumber { get; set; }

        public DateTime? ShipmentDate { get; set; }
        public string CarrierId { get; set; }
        public string TrackingCode { get; set; }

        // Seller + source order metadata for admin verification view
        public long? SellerId { get; set; }
        public string SellerName { get; set; }
        public string SellerEmail { get; set; }
        public Guid? SellerStoreId { get; set; }
        public string SellerStoreName { get; set; }
        public string PrimeShipOrderId { get; set; }
        public string PrimeShipTrackingNumber { get; set; }
        public DateTime? PrimeShipPurchasedAt { get; set; }

        public List<OrderItemDto> OrderItems { get; set; }
    }
}
