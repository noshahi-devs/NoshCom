using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Withdrawals.Dto;
using System.Threading.Tasks;

namespace Elicom.Withdrawals
{
    public interface ISmartStoreWithdrawAppService : IApplicationService
    {
        Task<SellerPayoutMethodDto> GetMyPayoutMethod();
        Task<SellerPayoutMethodDto> SaveMyPayoutMethod(SaveSellerPayoutMethodInput input);
        Task<WithdrawRequestDto> SubmitWithdrawRequest(CreateWithdrawRequestInput input);
        Task<PagedResultDto<WithdrawRequestDto>> GetMyWithdrawRequests(PagedAndSortedResultRequestDto input);
        Task<PagedResultDto<WithdrawRequestDto>> GetAllWithdrawRequests(PagedAndSortedResultRequestDto input);
        Task ApproveWithdraw(ApproveWithdrawRequestInput input);
        Task RejectWithdraw(ApproveWithdrawRequestInput input);
    }
}
