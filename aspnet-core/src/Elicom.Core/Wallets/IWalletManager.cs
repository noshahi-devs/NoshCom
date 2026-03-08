using System;
using System.Threading.Tasks;
using Abp.Domain.Services;

namespace Elicom.Wallets
{
    public interface IWalletManager : IDomainService
    {
        Task<decimal> GetBalanceAsync(long userId);
        Task DepositAsync(long userId, decimal amount, string referenceId, string description);
        Task<bool> TryDebitAsync(long userId, decimal amount, string referenceId, string description);
        Task TransferAsync(long senderUserId, long receiverUserId, decimal amount, string description);
    }
}
