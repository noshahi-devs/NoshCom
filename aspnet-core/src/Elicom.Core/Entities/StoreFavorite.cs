using Abp.Domain.Entities;
using System;

namespace Elicom.Entities
{
    public class StoreFavorite : Entity<Guid>
    {
        public long AdminUserId { get; set; }
        public Guid StoreId { get; set; }
        public DateTime CreatedAt { get; set; }

        public virtual Store Store { get; set; }
    }
}
