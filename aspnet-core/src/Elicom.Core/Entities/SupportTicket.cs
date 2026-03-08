using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;
using Elicom.Authorization.Users;
using System;
using System.ComponentModel.DataAnnotations;

namespace Elicom.Entities
{
    public class SupportTicket : FullAuditedEntity<Guid>, IMustHaveTenant
    {
        public int TenantId { get; set; }

        public long? UserId { get; set; } // Nullable for Contact Us from non-logged in users if allowed
        public virtual User User { get; set; }

        [Required]
        [StringLength(256)]
        public string Title { get; set; }

        [Required]
        public string Message { get; set; }

        [Required]
        public string Priority { get; set; } // Low, Medium, High

        [Required]
        public string Status { get; set; } // Open, Replied, Closed

        public string AdminRemarks { get; set; }

        public string ContactEmail { get; set; } // For non-logged in contact form
        public string ContactName { get; set; }

        public SupportTicket()
        {
            Status = "Open";
            Priority = "Medium";
        }
    }
}
