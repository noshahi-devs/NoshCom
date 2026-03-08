using System;
using System.Threading.Tasks;
using Abp.Domain.Services;

namespace Elicom.Wallets
{
    public interface ISmartStoreWalletManager : IDomainService
    {
        Task<decimal> GetBalanceAsync(long userId);
        Task CreditAsync(long userId, decimal amount, string referenceId, string description, string movementType = "Sale", string status = "Completed");
        Task<bool> TryDebitAsync(long userId, decimal amount, string referenceId, string description);
        Task<bool> TryHoldAsync(long userId, decimal amount, string referenceId, string description);
        Task UpdateTransactionStatusAsync(long userId, string referenceId, string status);
    }
}
