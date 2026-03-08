using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;
using System;

namespace Elicom.Entities
{
    public class WalletTransaction : CreationAuditedEntity<Guid>
    {
        public Guid WalletId { get; set; }
        public virtual Wallet Wallet { get; set; }

        public decimal Amount { get; set; } // Positive for Credit, Negative for Debit
        public string MovementType { get; set; } // "Deposit", "Purchase", "Refund", "ProfitDetails"
        
        public string ReferenceId { get; set; } // e.g., OrderId
        public string Description { get; set; }
    }
}
