using System;

namespace Elicom.Homepage.Dto
{
    public class OtherStoreDto
    {
        public Guid StoreId { get; set; }
        public string StoreName { get; set; }
        public decimal ResellerPrice { get; set; }
        public decimal ResellerDiscountPercentage { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
    }
}
