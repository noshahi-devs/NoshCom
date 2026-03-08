using Abp.Domain.Entities;
using System;

namespace Elicom.Entities
{
    public class OrderItem : Entity<Guid>
    {
        public Guid OrderId { get; set; }

        public Guid StoreProductId { get; set; }
        public Guid ProductId { get; set; }

        public int Quantity { get; set; }

        public decimal PriceAtPurchase { get; set; }
        public decimal OriginalPrice { get; set; }
        public decimal DiscountPercentage { get; set; }

        public string ProductName { get; set; }
        public string StoreName { get; set; }

        public virtual Order Order { get; set; }
        public virtual StoreProduct StoreProduct { get; set; }
    }
}
