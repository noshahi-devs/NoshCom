using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Withdrawals.Dto;
using System.Threading.Tasks;

namespace Elicom.Withdrawals
{
    public interface IWithdrawAppService : IApplicationService
    {
        Task<WithdrawRequestDto> SubmitWithdrawRequest(CreateWithdrawRequestInput input);
        Task<PagedResultDto<WithdrawRequestDto>> GetMyWithdrawRequests(PagedAndSortedResultRequestDto input);
        Task ApproveWithdraw(ApproveWithdrawRequestInput input);
        Task RejectWithdraw(ApproveWithdrawRequestInput input);
        Task<PagedResultDto<WithdrawRequestDto>> GetAllWithdrawRequests(PagedAndSortedResultRequestDto input);
        Task<string> GetPaymentProof(long id);
        Task<WithdrawalEligibilityDto> GetWithdrawalEligibility();
    }
}
