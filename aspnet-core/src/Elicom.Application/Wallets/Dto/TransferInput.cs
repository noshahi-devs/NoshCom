using System.ComponentModel.DataAnnotations;

namespace Elicom.Wallets.Dto
{
    public class TransferInput
    {
        [Required]
        [Range(1, double.MaxValue)]
        public decimal Amount { get; set; }

        public string Description { get; set; }

        // Wallet ID based transfers (Easy Finora)
        public string RecipientWalletId { get; set; }

        // Email fallback (legacy)
        public string RecipientEmail { get; set; }
    }
}
