using Abp.Application.Services.Dto;
using System;

namespace Elicom.StoreProducts.Dto
{
    public class GetStoreProductsPagedInput : PagedAndSortedResultRequestDto
    {
        public Guid StoreId { get; set; }
    }
}
