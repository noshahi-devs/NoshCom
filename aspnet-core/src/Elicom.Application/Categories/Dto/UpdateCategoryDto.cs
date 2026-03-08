using Abp.Application.Services.Dto;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.Categories.Dto
{
    public class UpdateCategoryDto : EntityDto<Guid>
    {
        public int? TenantId { get; set; }
        [Required]
        public string Name { get; set; }

        public string Slug { get; set; }
        public string ImageUrl { get; set; }
        public bool Status { get; set; }
    }
}
