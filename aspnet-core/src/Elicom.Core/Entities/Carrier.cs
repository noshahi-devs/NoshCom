using Abp.Domain.Entities;
using System.ComponentModel.DataAnnotations;

namespace Elicom.Entities
{
    public class Carrier : Entity<int>
    {
        [Required]
        [StringLength(128)]
        public string Name { get; set; }

        public string Code { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
