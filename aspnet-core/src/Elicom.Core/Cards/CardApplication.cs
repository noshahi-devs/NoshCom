using System;
using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;

namespace Elicom.Cards
{
    public class CardApplication : FullAuditedEntity<Guid>, IMustHaveTenant
    {
        public int TenantId { get; set; }
        public long UserId { get; set; }
        
        [System.ComponentModel.DataAnnotations.Schema.ForeignKey("UserId")]
        public virtual Elicom.Authorization.Users.User User { get; set; }
        
        public string FullName { get; set; }
        public string ContactNumber { get; set; }
        public string Address { get; set; }
        public CardType CardType { get; set; } // Visa, MasterCard, Amex
        public string DocumentBase64 { get; set; } // Base64 encoded document
        public string DocumentType { get; set; } // pdf, jpg, jpeg, png
        public CardApplicationStatus Status { get; set; } // Pending, Approved, Rejected
        
        public DateTime AppliedDate { get; set; }
        public DateTime? ReviewedDate { get; set; }
        public long? ReviewedBy { get; set; } // Admin user ID
        public string ReviewNotes { get; set; } // Optional admin notes
        public long? GeneratedCardId { get; set; } // Link to VirtualCard after approval
        public long? PreviousCardId { get; set; } // Card to deactivate/replace during re-application
    }
}
