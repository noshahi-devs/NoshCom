using Abp.Application.Services.Dto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.Products.Dto
{

    public class UpdateProductDto : EntityDto<Guid>
    {
        public int? TenantId { get; set; }
        public string Name { get; set; }
        public Guid CategoryId { get; set; }

        public string Description { get; set; }
        public string Images { get; set; }
        public string SizeOptions { get; set; }
        public string ColorOptions { get; set; }

        public decimal DiscountPercentage { get; set; }
        public decimal SupplierPrice { get; set; }
        public decimal ResellerMaxPrice { get; set; }

        public int StockQuantity { get; set; }
        public string SKU { get; set; }
        public string BrandName { get; set; }

        public string Slug { get; set; }

        public bool Status { get; set; }
    }

}
