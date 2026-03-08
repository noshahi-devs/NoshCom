using Abp.Domain.Entities;
using Elicom.Entities;
using System;
using System.Collections.Generic;

namespace Elicom.Entities
{
    public class Product : Entity<Guid>, IMayHaveTenant
    {
        public int? TenantId { get; set; }
        public string Name { get; set; }

        public long? SupplierId { get; set; } // Link to AbpUsers

        // FK
        public Guid CategoryId { get; set; }

        // Navigation Property
        public Category Category { get; set; }

        public string Description { get; set; }

        // JSON fields
        public string Images { get; set; }          // JSON string
        public string SizeOptions { get; set; }     // JSON string
        public string ColorOptions { get; set; }    // JSON string

        public decimal DiscountPercentage { get; set; }
        public decimal SupplierPrice { get; set; }
        public decimal ResellerMaxPrice { get; set; }

        public int StockQuantity { get; set; }
        public string SKU { get; set; }

        public string BrandName { get; set; }

        public string Slug { get; set; }

        public bool Status { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public virtual ICollection<StoreProduct> StoreProducts { get; set; }


    }
}
