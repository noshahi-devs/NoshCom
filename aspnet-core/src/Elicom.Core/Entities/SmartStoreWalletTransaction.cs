using Abp.Domain.Entities.Auditing;
using System;

namespace Elicom.Entities
{
    public class SmartStoreWalletTransaction : CreationAuditedEntity<Guid>
    {
        public Guid WalletId { get; set; }
        public virtual SmartStoreWallet Wallet { get; set; }

        public decimal Amount { get; set; } // Positive for Credit, Negative for Debit
        public string MovementType { get; set; } // "Sale", "Payout", "Refund"
        
        public string ReferenceId { get; set; } // e.g., OrderId
        public string Description { get; set; }
        public string Status { get; set; } = "Completed"; // "Pending", "Completed", "Failed"
    }
}
