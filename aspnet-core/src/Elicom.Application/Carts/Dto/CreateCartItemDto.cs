using System;
using System.ComponentModel.DataAnnotations;

namespace Elicom.Carts.Dto
{
    public class CreateCartItemDto
    {
        // Optional for backward compatibility; server always uses session user id.
        public long? UserId { get; set; }

        [Required]
        public Guid StoreProductId { get; set; }

        [Required]
        public int Quantity { get; set; }
    }
}
