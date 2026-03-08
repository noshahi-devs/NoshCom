using System.ComponentModel.DataAnnotations;
using Abp.Authorization.Users;

namespace Elicom.Authorization.Accounts.Dto;

public class RegisterPrimeShipInput
{
    [Required]
    [EmailAddress]
    [StringLength(AbpUserBase.MaxEmailAddressLength)]
    public string EmailAddress { get; set; }

    [Required]
    public string FullName { get; set; }

    [Required]
    [StringLength(AbpUserBase.MaxPlainPasswordLength)]
    public string Password { get; set; }

    [Required]
    public string PhoneNumber { get; set; }

    [Required]
    public string Country { get; set; }
}
