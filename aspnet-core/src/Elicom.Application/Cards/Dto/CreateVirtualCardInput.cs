namespace Elicom.Cards.Dto
{
    public class CreateVirtualCardInput
    {
        public CardType CardType { get; set; } // Visa, MasterCard, Amex
        public string FullName { get; set; }
        public string ContactNumber { get; set; }
        public string Address { get; set; }
        public string DocumentPath { get; set; } // Path or base64 of uploaded document
    }
}
