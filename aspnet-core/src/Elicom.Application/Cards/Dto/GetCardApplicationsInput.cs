using Abp.Application.Services.Dto;

namespace Elicom.Cards.Dto
{
    public class GetCardApplicationsInput : PagedAndSortedResultRequestDto
    {
        /// <summary>Optional: Pending, Approved, Rejected — omit or "all" for every status.</summary>
        public string StatusFilter { get; set; }
    }
}
