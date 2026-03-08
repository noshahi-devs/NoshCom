using Abp.Domain.Entities.Auditing;
using Elicom.Authorization.Users;
using System.ComponentModel.DataAnnotations.Schema;
using System;

using Abp.Domain.Entities;

namespace Elicom.Entities
{
    public class CartItem : FullAuditedEntity<Guid>, IMayHaveTenant
    {
        public int? TenantId { get; set; }
        // Link to user
        public long UserId { get; set; }
        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; }

        // Link to product-store
        public Guid StoreProductId { get; set; }
        public virtual StoreProduct StoreProduct { get; set; }

        public int Quantity { get; set; }

        // Snapshot of price and discount at time of adding to cart
        public decimal Price { get; set; }
        public decimal OriginalPrice { get; set; }
        public decimal ResellerDiscountPercentage { get; set; }

        // Optional: you may track status (active, ordered, removed)
        public string Status { get; set; } = "Active";
    }
}
