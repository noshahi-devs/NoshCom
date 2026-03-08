using Abp.Domain.Entities;
using System;

namespace Elicom.Entities
{
    public class StoreProduct : Entity<Guid>
    {
        public Guid StoreId { get; set; }
        public Guid ProductId { get; set; }

        public decimal ResellerPrice { get; set; }
        public decimal ResellerDiscountPercentage { get; set; }

        public int StockQuantity { get; set; }
        public bool Status { get; set; }

        public virtual Store Store { get; set; }
        public virtual Product Product { get; set; }
    }
}
