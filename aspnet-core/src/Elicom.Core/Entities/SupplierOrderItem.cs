using Abp.Domain.Entities;
using System;

namespace Elicom.Entities
{
    public class SupplierOrderItem : Entity<Guid>
    {
        public Guid SupplierOrderId { get; set; }

        public Guid ProductId { get; set; }

        public int Quantity { get; set; }

        // Actual price seller paid to supplier
        public decimal PurchasePrice { get; set; }

        public virtual SupplierOrder SupplierOrder { get; set; }
        public virtual Product Product { get; set; }
    }
}
