using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;
using Elicom.Authorization.Users;
using System;
using System.ComponentModel.DataAnnotations;

namespace Elicom.Entities
{
    public class DepositRequest : FullAuditedEntity<Guid>, IMustHaveTenant
    {
        public int TenantId { get; set; }

        public long UserId { get; set; }
        public virtual User User { get; set; }

        public long? CardId { get; set; }

        [Required]
        public decimal Amount { get; set; }

        public decimal? LocalAmount { get; set; }

        public string LocalCurrency { get; set; }

        [Required]
        public string Currency { get; set; }

        [Required]
        public string Country { get; set; }

        // The bank account/method shown to the user based on country
        public string DestinationAccount { get; set; }

        // Path to the screenshot (SS) proof
        public string ProofImage { get; set; }

        // Pending, Approved, Rejected
        public string Status { get; set; }

        public string Method { get; set; } // P2P, Crypto

        public string SourcePlatform { get; set; }

        public string AdminRemarks { get; set; }

        public string ReferenceId { get; set; } // Transaction / Payment reference ID

        public DepositRequest()
        {
            Status = "Pending";
            Currency = "USD"; // Default
            Method = "P2P"; // Default
        }
    }
}
