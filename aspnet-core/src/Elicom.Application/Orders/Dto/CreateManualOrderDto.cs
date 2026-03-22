using System;

namespace Elicom.Orders.Dto
{
    public class CreateManualOrderDto
    {
        public Guid StoreId { get; set; }
        public Guid StoreProductId { get; set; }
        public int Quantity { get; set; }

        // Recipient Information
        public string RecipientName { get; set; }
        public string RecipientEmail { get; set; }
        public string RecipientPhone { get; set; }

        // Shipping Address
        public string ShippingAddress { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Country { get; set; }
        public string PostalCode { get; set; }

        // Optional
        public decimal? OverridePrice { get; set; }
        public string Notes { get; set; }
    }
}
