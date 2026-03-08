using Abp.Application.Services.Dto;
using System;

namespace Elicom.Wallets.Dto
{
    public class SmartStoreWalletDto : EntityDto<Guid>
    {
        public decimal Balance { get; set; }
        public string Currency { get; set; }
        public decimal? WithdrawLimit { get; set; }
        public DateTime? WithdrawAllowedUntil { get; set; }
        public string AdminWithdrawRemarks { get; set; }
    }

    public class SmartStoreWalletTransactionDto : EntityDto<Guid>
    {
        public Guid WalletId { get; set; }
        public decimal Amount { get; set; }
        public string MovementType { get; set; }
        public string ReferenceId { get; set; }
        public string Description { get; set; }
        public string Status { get; set; }
        public DateTime CreationTime { get; set; }
    }
}
