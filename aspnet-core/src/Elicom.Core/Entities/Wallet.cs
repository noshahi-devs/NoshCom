using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;
using Elicom.Authorization.Users;
using System;

namespace Elicom.Entities
{
    public class Wallet : FullAuditedEntity<Guid>
    {
        public long UserId { get; set; }
        public virtual User User { get; set; }

        public decimal Balance { get; set; }
        public string Currency { get; set; } = "PKR";

        // Optimistic Concurrency Token
        public byte[] RowVersion { get; set; }
    }
}
