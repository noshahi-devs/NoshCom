using System;
using System.Collections.Generic;
using Elicom.OrderItems.Dto;

namespace Elicom.Orders.Dto
{
    public class CreateOrderDto
    {
        public long UserId { get; set; }
        public string PaymentMethod { get; set; }

        public string ShippingAddress { get; set; }
        public string Country { get; set; }
        public string State { get; set; }
        public string City { get; set; }
        public string PostalCode { get; set; }
        
        public string RecipientName { get; set; }
        public string RecipientPhone { get; set; }
        public string RecipientEmail { get; set; }

        public decimal ShippingCost { get; set; }
        public decimal Discount { get; set; }
        public string SourcePlatform { get; set; }

        // Card details for Finora/External payment
        public string CardNumber { get; set; }
        public string Cvv { get; set; }
        public string ExpiryDate { get; set; }
        public List<OrderItemDto> Items { get; set; } = new List<OrderItemDto>();
    }
}
