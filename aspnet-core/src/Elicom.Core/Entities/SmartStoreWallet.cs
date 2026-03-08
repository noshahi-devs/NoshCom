using Abp.Domain.Entities.Auditing;
using Elicom.Authorization.Users;
using System;

namespace Elicom.Entities
{
    public class SmartStoreWallet : FullAuditedEntity<Guid>
    {
        public long UserId { get; set; }
        public virtual User User { get; set; }

        public decimal Balance { get; set; }
        public string Currency { get; set; } = "USD";

        public decimal? WithdrawLimit { get; set; }
        public DateTime? WithdrawAllowedUntil { get; set; }
        public string AdminWithdrawRemarks { get; set; }

        // Optimistic Concurrency Token
        public byte[] RowVersion { get; set; }
    }
}
