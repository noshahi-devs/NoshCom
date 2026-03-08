using System;
using System.Collections.Generic;

namespace Elicom.Wholesale.Dto
{
    public class CreateWholesaleOrderInput
    {
        public List<WholesaleOrderItemInput> Items { get; set; }
        public string ShippingAddress { get; set; }
        public string CustomerName { get; set; }
        
        // Payment Details
        public string PaymentMethod { get; set; }
        public string CardNumber { get; set; }
        public string ExpiryDate { get; set; }
        public string Cvv { get; set; }
    }

    public class WholesaleOrderItemInput
    {
        public Guid ProductId { get; set; }
        public int Quantity { get; set; }
    }
}
