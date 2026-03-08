using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.ComponentModel.DataAnnotations;

namespace Elicom.Categories.Dto
{

    public class CreateCategoryDto
    {
        public int? TenantId { get; set; }
        [Required]
        public string Name { get; set; }

        public string Slug { get; set; }
        public string ImageUrl { get; set; }
        public bool Status { get; set; }
    }

}
