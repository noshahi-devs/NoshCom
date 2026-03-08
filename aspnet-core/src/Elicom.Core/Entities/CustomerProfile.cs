using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;
using Elicom.Authorization.Users; // <- use your User class
using System;

namespace Elicom.Entities
{
    public class CustomerProfile : FullAuditedEntity<Guid>
    {
        // FK to ABP User
        public long UserId { get; set; }

        public string FullName { get; set; }
        public string PhoneNumber { get; set; }
        public string Email { get; set; }

        public string AddressLine1 { get; set; }
        public string AddressLine2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Country { get; set; }

        // Optional Profile Picture URL
        public string ProfilePictureUrl { get; set; }

        // Navigation property
        public virtual User User { get; set; } // <- use your custom User
    }
}
