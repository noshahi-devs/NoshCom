using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;
using Elicom.Authorization.Users;
using System.ComponentModel.DataAnnotations;
using System;

namespace Elicom.Entities
{
    public class AppTransaction : CreationAuditedEntity<long>, IMustHaveTenant
    {
        public int TenantId { get; set; }

        public long UserId { get; set; }
        public virtual User User { get; set; }

        public long? CardId { get; set; }

        [Required]
        public decimal Amount { get; set; }

        [Required]
        public string MovementType { get; set; } // Credit, Debit

        [Required]
        public string Category { get; set; } // Deposit, Withdrawal, Transfer, Purchase

        public string ReferenceId { get; set; }
        
        public Guid? OrderId { get; set; }
        
        public string Status { get; set; } // Pending, Approved

        public string Description { get; set; }

        public AppTransaction()
        {
        }
    }
}
