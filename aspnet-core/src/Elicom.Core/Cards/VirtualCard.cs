using System;
using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;

namespace Elicom.Cards
{
    public class VirtualCard : FullAuditedEntity<long>, IMustHaveTenant
    {
        public int TenantId { get; set; }
        
        public long UserId { get; set; }
        
        public string CardNumber { get; set; }
        
        public CardType CardType { get; set; } // Visa, MasterCard, Amex
        
        public string HolderName { get; set; }
        
        public string ExpiryDate { get; set; } // MM/yy format
        
        public string Cvv { get; set; }
        
        public decimal Balance { get; set; }
        
        public string Currency { get; set; } // USD
        
        public string Status { get; set; } // Active, Inactive, Blocked, Expired
    }
}
