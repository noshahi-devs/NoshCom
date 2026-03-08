using Elicom.Categories.Dto;
using System;
using System.Collections.Generic;

namespace Elicom.Homepage.Dto
{
    public class ProductDetailDto
    {
        public Guid ProductId { get; set; }
        public string Title { get; set; }
        public string Slug { get; set; }
        public string Description { get; set; }
        public string BrandName { get; set; }

        public List<string> Images { get; set; }
        public List<string> SizeOptions { get; set; }
        public List<string> ColorOptions { get; set; }

        public CategoryInfoDto Category { get; set; }
        public StoreInfoDto Store { get; set; }


        public List<OtherStoreDto> OtherStores { get; set; }
        public int TotalOtherStores { get; set; }
    }
}
