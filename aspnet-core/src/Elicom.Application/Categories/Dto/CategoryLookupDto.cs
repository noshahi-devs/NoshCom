using Abp.Application.Services.Dto;
using System;

namespace Elicom.Categories.Dto
{
    public class CategoryLookupDto : EntityDto<Guid>
    {
        public string Name { get; set; }
        public string Slug { get; set; }
    }
}
