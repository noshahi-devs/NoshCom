using Abp.Application.Services.Dto;

namespace Elicom.Wallets.Dto
{
    public class WalletDto : EntityDto<System.Guid>
    {
        public decimal Balance { get; set; }
        public string Currency { get; set; }
        public string DisplayWalletId { get; set; }
    }

    public class WalletTransactionDto : EntityDto<System.Guid>
    {
        public System.Guid WalletId { get; set; }
        public decimal Amount { get; set; }
        public string Type { get; set; } // Sale, Withdrawal, Deposit, Transfer
        public string ReferenceId { get; set; }
        public string Description { get; set; }
        public System.DateTime CreationTime { get; set; }
    }
}
