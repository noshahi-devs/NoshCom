using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.GlobalPay.Dto;
using System;
using System.Threading.Tasks;

namespace Elicom.GlobalPay
{
    public interface IDepositRequestAppService : IApplicationService
    {
        Task<DepositRequestDto> Create(CreateDepositRequestInput input);
        Task<PagedResultDto<DepositRequestDto>> GetMyRequests(PagedAndSortedResultRequestDto input);
        
        // Admin Only
        Task<PagedResultDto<DepositRequestDto>> GetAllRequests(PagedAndSortedResultRequestDto input);
        Task<string> GetProofImage(Guid id);
        Task Approve(ApproveDepositRequestInput input);
        Task Reject(ApproveDepositRequestInput input);
    }
}
