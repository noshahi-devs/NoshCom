namespace Elicom.Withdrawals.Dto
{
    public class SellerPayoutMethodDto
    {
        public string MethodKey { get; set; }
        public string MethodLabel { get; set; }

        public string AccountTitle { get; set; }
        public string BankName { get; set; }
        public string AccountNumberMasked { get; set; }
        public string RoutingNumber { get; set; }
        public string SwiftCode { get; set; }

        public string WalletId { get; set; }

        public string CardHolderName { get; set; }
        public string CardNumberMasked { get; set; }
        public string ExpiryDate { get; set; }

        public bool IsEasyFinoraVerified { get; set; }
        public string VerificationMessage { get; set; }

        public string PaymentDetails { get; set; }
    }

    public class SaveSellerPayoutMethodInput
    {
        public string MethodKey { get; set; }

        public string AccountTitle { get; set; }
        public string BankName { get; set; }
        public string AccountNumber { get; set; }
        public string RoutingNumber { get; set; }
        public string SwiftCode { get; set; }

        public string WalletId { get; set; }

        public string CardHolderName { get; set; }
        public string CardNumber { get; set; }
        public string ExpiryDate { get; set; }
    }
}
