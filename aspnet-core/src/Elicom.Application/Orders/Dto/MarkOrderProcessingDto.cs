using Abp.Application.Services.Dto;
using System;

namespace Elicom.Orders.Dto
{
    public class MarkOrderProcessingDto : EntityDto<Guid>
    {
        public string SupplierReference { get; set; }
    }
}
