using System;
using Abp.AutoMapper;
using Elicom.Cards;

namespace Elicom.Cards.Dto
{
    [AutoMap(typeof(CardApplication))]
    public class CardApplicationDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; }
        public string ContactNumber { get; set; }
        public string Address { get; set; }
        public CardType CardType { get; set; }
        public string DocumentBase64 { get; set; }
        public string DocumentType { get; set; }
        public string UserName { get; set; }
        public string Status { get; set; }
        public DateTime AppliedDate { get; set; }
        public DateTime? ReviewedDate { get; set; }
        public string ReviewNotes { get; set; }
        
        // Generated Card Information (for approved applications)
        public long? GeneratedCardId { get; set; }
        public string GeneratedCardNumber { get; set; }
        public CardType? GeneratedCardType { get; set; }
    }
}
