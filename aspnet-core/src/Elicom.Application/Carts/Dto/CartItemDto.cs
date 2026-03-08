using Abp.Application.Services.Dto;
using System;

namespace Elicom.Carts.Dto
{
    public class CartItemDto : EntityDto<Guid>
    {
        public long UserId { get; set; }
        public Guid StoreProductId { get; set; }
        public int Quantity { get; set; }

        public decimal Price { get; set; }
        public decimal OriginalPrice { get; set; }
        public decimal ResellerDiscountPercentage { get; set; }

        public string ProductTitle { get; set; }
        public string ProductImage { get; set; }
        public string StoreName { get; set; }
    }
}
