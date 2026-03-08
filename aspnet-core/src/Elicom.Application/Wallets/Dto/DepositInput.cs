using System.ComponentModel.DataAnnotations;

namespace Elicom.Wallets.Dto
{
    public class DepositInput
    {
        [Range(1, 1000000)]
        public decimal Amount { get; set; }
        
        [Required]
        public string Method { get; set; } // "JazzCash", "EasyPaisa"
    }
}
