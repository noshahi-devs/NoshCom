using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.StoreProducts.Dto
{
    public class CreateStoreProductDto
    {
        public Guid StoreId { get; set; }
        public Guid ProductId { get; set; }
        public decimal ResellerPrice { get; set; }
        public decimal ResellerDiscountPercentage { get; set; }

        public int StockQuantity { get; set; }
        public bool Status { get; set; }
    }

}
