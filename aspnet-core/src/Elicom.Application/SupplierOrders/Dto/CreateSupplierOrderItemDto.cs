using System;

namespace Elicom.SupplierOrders.Dto
{
    public class CreateSupplierOrderItemDto
    {
        public Guid ProductId { get; set; }
        public int Quantity { get; set; }
        public decimal PurchasePrice { get; set; }
    }
}
