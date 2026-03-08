using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Abp.Application.Services.Dto;


namespace Elicom.StoreProducts.Dto
{

    public class StoreProductDto : EntityDto<Guid>
    {
        public Guid StoreId { get; set; }
        public Guid ProductId { get; set; }
        public decimal ResellerPrice { get; set; }
        public decimal ResellerDiscountPercentage { get; set; }

        public int StockQuantity { get; set; }
        public bool Status { get; set; }

        public string ProductName { get; set; }
        public string ProductImage { get; set; }
        public string BrandName { get; set; }
    }

}
