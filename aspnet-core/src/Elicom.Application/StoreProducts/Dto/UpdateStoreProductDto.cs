using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Abp.Application.Services.Dto;


namespace Elicom.StoreProducts.Dto
{

    public class UpdateStoreProductDto : EntityDto<Guid>
    {
        public decimal ResellerPrice { get; set; }
        public decimal ResellerDiscountPercentage { get; set; }

        public int StockQuantity { get; set; }
        public bool Status { get; set; }
    }

}
