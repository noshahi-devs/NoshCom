using Abp.Domain.Entities;
using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elicom.Entities
{
    [Table("Warehouses")]
    public class Warehouse : Entity<Guid>
    {
        public string Name { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Country { get; set; }
        
        public Guid StoreId { get; set; }
        [ForeignKey("StoreId")]
        public virtual Store Store { get; set; }
        
        public bool IsDefault { get; set; }
        public bool Status { get; set; }
        public DateTime CreationTime { get; set; }

        public Warehouse()
        {
            CreationTime = DateTime.Now;
            Status = true;
        }
    }
}
