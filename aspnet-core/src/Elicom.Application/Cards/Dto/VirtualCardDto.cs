namespace Elicom.Cards.Dto
{
    public class VirtualCardDto
    {
        public long CardId { get; set; }
        
        public string CardNumber { get; set; }
        
        public CardType CardType { get; set; }
        
        public string HolderName { get; set; }
        
        public string ExpiryDate { get; set; }
        
        public string Cvv { get; set; }
        
        public decimal Balance { get; set; }
        
        public string Currency { get; set; }
        
        public string Status { get; set; }

        public string ActiveSubscription { get; set; }

        public string ActiveSubscriptionCode { get; set; }

        public string PendingSubscription { get; set; }

        public string PendingSubscriptionCode { get; set; }
    }
}
