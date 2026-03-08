using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Support.Dto;
using System;
using System.Threading.Tasks;

namespace Elicom.Support
{
    public interface ISupportTicketAppService : IApplicationService
    {
        Task<SupportTicketDto> Create(CreateSupportTicketInput input);
        Task<PagedResultDto<SupportTicketDto>> GetMyTickets(PagedAndSortedResultRequestDto input);
        Task<PagedResultDto<SupportTicketDto>> GetAllTickets(PagedAndSortedResultRequestDto input);
        Task UpdateStatus(UpdateSupportTicketStatusInput input);
    }
}
