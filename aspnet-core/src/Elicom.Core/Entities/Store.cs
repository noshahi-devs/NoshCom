using Abp.Domain.Entities;
using Elicom.Authorization.Users;
using System;
using System.Collections.Generic;

namespace Elicom.Entities
{
    public class Store : Entity<Guid>
    {
        public string Name { get; set; }
        public long OwnerId { get; set; } // <-- long to match User.Id
        public string ShortDescription { get; set; }
        public string LongDescription { get; set; }
        public string Description { get; set; } // Keep for compatibility
        public string Slug { get; set; }
        public string SupportEmail { get; set; }
        public bool Status { get; set; } // Approval status
        public bool IsActive { get; set; } = true;
        public bool IsAdminActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public virtual User Owner { get; set; }

        public virtual ICollection<StoreProduct> StoreProducts { get; set; }
        public virtual StoreKyc Kyc { get; set; }
    }
}
