using Abp.Application.Services.Dto;
using System;

namespace Elicom.Orders.Dto
{
    public class OrderListItemDto : EntityDto<Guid>
    {
        public string OrderNumber { get; set; }
        public DateTime CreationTime { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; }
        public string PaymentStatus { get; set; }
        public string ProductName { get; set; }
        public string StoreName { get; set; }
    }
}
