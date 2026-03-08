using System;
using Abp.Application.Services.Dto;

namespace Elicom.StoreProducts.Dto
{
    public class MapProductDto
    {
        public Guid StoreId { get; set; }
        public Guid ProductId { get; set; }
        public decimal ResellerPrice { get; set; }
        public int StockQuantity { get; set; } = 10; // Default stock
        public bool Status { get; set; } = true;
    }
}
