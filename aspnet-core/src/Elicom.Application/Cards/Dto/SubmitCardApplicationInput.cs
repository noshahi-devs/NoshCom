namespace Elicom.Cards.Dto
{
    public class SubmitCardApplicationInput
    {
        public string FullName { get; set; }
        public string ContactNumber { get; set; }
        public string Address { get; set; }
        public CardType CardType { get; set; } // Visa, MasterCard, Amex
        public string DocumentBase64 { get; set; }
        public string DocumentType { get; set; } // pdf, jpg, jpeg, png
    }
}
