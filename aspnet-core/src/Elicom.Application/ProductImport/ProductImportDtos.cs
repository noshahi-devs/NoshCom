using System;
using System.Collections.Generic;

namespace Elicom.ProductImport
{
    public class ProductImportRequestDto
    {
        public string Url { get; set; }
    }

    public class ProductImportResultDto
    {
        public string SourceUrl { get; set; }
        public string Name { get; set; }
        public string Brand { get; set; }
        public string Description { get; set; }
        public decimal? Price { get; set; }
        public decimal? ListPrice { get; set; }
        public string Currency { get; set; }
        public string CategoryHint { get; set; }
        public List<string> Images { get; set; } = new List<string>();
        public string Warning { get; set; }
    }
}
