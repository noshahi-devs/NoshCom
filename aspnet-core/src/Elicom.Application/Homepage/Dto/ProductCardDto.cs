using Abp.Application.Services.Dto;
using System;

namespace Elicom.Homepage.Dto
{
    public class ProductCardDto : EntityDto<Guid>
    {
        public Guid ProductId { get; set; }
        public Guid StoreProductId { get; set; }
        public Guid CategoryId { get; set; }

        public string Title { get; set; }

        public string Image1 { get; set; }
        public string Image2 { get; set; }

        public decimal Price { get; set; }
        public decimal OriginalPrice { get; set; }
        public decimal ResellerDiscountPercentage { get; set; }

        public string StoreName { get; set; }
        public string CategoryName { get; set; }

        public string Slug { get; set; }
    }
}
