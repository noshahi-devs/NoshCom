using System;

namespace Elicom.Homepage.Dto
{
    public class StoreInfoDto
    {
        public Guid StoreId { get; set; }
        public string StoreName { get; set; }
        public string StoreDescription { get; set; }
        public string StoreSlug { get; set; }

        public decimal ResellerPrice { get; set; }
        public decimal ResellerDiscountPercentage { get; set; }
        public decimal Price { get; set; } // Calculated: ResellerPrice*(1-discount)
        public int StockQuantity { get; set; }
    }
}
