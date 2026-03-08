using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;
using Elicom.Authorization.Users;
using System.ComponentModel.DataAnnotations;

namespace Elicom.Entities
{
    public class WithdrawRequest : FullAuditedEntity<long>, IMustHaveTenant
    {
        public decimal ServiceFee { get; set; }
        public decimal NetAmount { get; set; }

        public WithdrawRequest()
        {
            Status = "Pending";
            Currency = "USD";
            LocalCurrency = "USD";
            ServiceFee = 0;
            NetAmount = 0;
        }

        public int TenantId { get; set; }

        public long UserId { get; set; }
        public virtual User User { get; set; }

        public long CardId { get; set; }

        [Required]
        public decimal Amount { get; set; }

        [Required]
        public string Currency { get; set; }

        [Required]
        public string Method { get; set; } // Bank, Crypto, etc.

        [Required]
        public string PaymentDetails { get; set; } // Acc No, Wallet Address, etc.

        // Pending, Approved, Rejected
        public string Status { get; set; }

        public string AdminRemarks { get; set; }

        public decimal LocalAmount { get; set; }
        public string LocalCurrency { get; set; }
        public string PaymentProof { get; set; }
    }
}
