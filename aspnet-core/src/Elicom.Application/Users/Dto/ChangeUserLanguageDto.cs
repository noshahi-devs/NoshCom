using System.ComponentModel.DataAnnotations;

namespace Elicom.Users.Dto;

public class ChangeUserLanguageDto
{
    [Required]
    public string LanguageName { get; set; }
}