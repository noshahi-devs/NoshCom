using System;
using System.ComponentModel.DataAnnotations;

namespace Elicom.Orders.Dto
{
    public class VerifyOrderDto
    {
        [Required]
        public string Id { get; set; }
    }
}
