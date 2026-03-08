using System;

namespace Elicom.Homepage.Dto
{
    public class HomepageCategoryDto
    {
        public Guid CategoryId { get; set; }
        public string Name { get; set; }
        public string Slug { get; set; }
        public string ImageUrl { get; set; }

        // optional, for showing number of listed products in this category
        public int TotalProducts { get; set; }
    }
}
