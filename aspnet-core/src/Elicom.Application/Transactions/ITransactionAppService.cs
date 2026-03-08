using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Transactions.Dto;
using System.Threading.Tasks;

namespace Elicom.Transactions
{
    public interface ITransactionAppService : IApplicationService
    {
        Task<PagedResultDto<TransactionDto>> GetHistory(PagedAndSortedResultRequestDto input);
        Task<PagedResultDto<TransactionDto>> GetAll(PagedAndSortedResultRequestDto input);
    }
}
