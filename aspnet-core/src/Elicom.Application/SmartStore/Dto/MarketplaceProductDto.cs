using Abp.Application.Services.Dto;
using System;

namespace Elicom.SmartStore.Dto
{
    public class MarketplaceProductDto : EntityDto<Guid>
    {
        public string StoreName { get; set; }
        public string StoreSlug { get; set; }
        
        public string ProductName { get; set; }
        public string ProductImage { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public string CategoryName { get; set; }
        public string BrandName { get; set; }
        public Guid ProductId { get; set; }
    }
}
