using Abp.Application.Services.Dto;

namespace Elicom.Homepage.Dto
{
    public class GetProductsInput : PagedAndSortedResultRequestDto
    {
        public string SearchTerm { get; set; }
    }
}
