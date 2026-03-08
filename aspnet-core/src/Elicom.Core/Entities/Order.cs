using Abp.Domain.Entities.Auditing;
using Elicom.Authorization.Users;
using System.ComponentModel.DataAnnotations.Schema;
using System;
using System.Collections.Generic;

using Abp.Domain.Entities;

namespace Elicom.Entities
{
    public class Order : FullAuditedEntity<Guid>
    {
        // Customer info
        public long UserId { get; set; }
        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; }

        // Order details
        public string OrderNumber { get; set; }
        public string Status { get; set; } = "Pending"; // Pending → PendingVerification → Verified → Delivered
        public string PaymentStatus { get; set; } = "Pending";
        public string PaymentMethod { get; set; }

        // SmartStore, PrimeShip, GlobalPay
        public string SourcePlatform { get; set; }

        // Amounts
        public decimal SubTotal { get; set; }
        public decimal ShippingCost { get; set; }
        public decimal Discount { get; set; }
        public decimal TotalAmount { get; set; }

        // Shipping address snapshot
        public string ShippingAddress { get; set; }
        public string Country { get; set; }
        public string State { get; set; }
        public string City { get; set; }
        public string PostalCode { get; set; }
        
        public string RecipientName { get; set; }
        public string RecipientPhone { get; set; }
        public string RecipientEmail { get; set; }

        // Seller sets after purchasing from supplier
        public string SupplierReference { get; set; }

        // Shipment Details (Generic Order Flow)
        public DateTime? ShipmentDate { get; set; }
        public string CarrierId { get; set; }
        public string TrackingCode { get; set; }

        // Store/Admin sets when delivering to buyer
        public string DeliveryTrackingNumber { get; set; }

        public virtual ICollection<OrderItem> OrderItems { get; set; }
    }
}
