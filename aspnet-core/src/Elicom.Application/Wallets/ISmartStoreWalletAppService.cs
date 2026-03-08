using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Wallets.Dto;
using System.Threading.Tasks;

namespace Elicom.Wallets
{
    public interface ISmartStoreWalletAppService : IApplicationService
    {
        Task<SmartStoreWalletDto> GetMyWallet();
        Task<ListResultDto<SmartStoreWalletTransactionDto>> GetTransactions();
    }
}
