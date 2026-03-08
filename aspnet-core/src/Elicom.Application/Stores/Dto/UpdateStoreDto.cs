using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Abp.Application.Services.Dto;

namespace Elicom.Stores.Dto
{   

    public class UpdateStoreDto : EntityDto<Guid>
    {
        [Required]
        public string Name { get; set; }
        public string ShortDescription { get; set; }
        public string LongDescription { get; set; }
        public string Description { get; set; }
        public string Slug { get; set; }
        public bool Status { get; set; }
        public bool IsActive { get; set; }
    }

}
