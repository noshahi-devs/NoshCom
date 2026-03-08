using System.ComponentModel.DataAnnotations;

namespace Elicom.Authorization.Accounts.Dto
{
    public class ResetPasswordInput
    {
        [Required]
        public long UserId { get; set; }

        [Required]
        public string Token { get; set; }

        [Required]
        public string NewPassword { get; set; }
    }
}
