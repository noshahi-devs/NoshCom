using Abp.Application.Services.Dto;
using System;

namespace Elicom.Warehouses.Dto
{
    public class WarehouseDto : EntityDto<Guid>
    {
        public string Name { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Country { get; set; }
        public Guid StoreId { get; set; }
        public bool IsDefault { get; set; }
        public bool Status { get; set; }
    }

    public class CreateWarehouseInput
    {
        public string Name { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Country { get; set; }
        public Guid StoreId { get; set; }
        public bool IsDefault { get; set; }
    }
}
