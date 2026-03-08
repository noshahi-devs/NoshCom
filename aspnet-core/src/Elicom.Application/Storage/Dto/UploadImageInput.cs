using System.ComponentModel.DataAnnotations;

namespace Elicom.Storage.Dto
{
    public class UploadImageInput
    {
        [Required]
        public string Base64Image { get; set; }

        public string FileName { get; set; }
    }
}
