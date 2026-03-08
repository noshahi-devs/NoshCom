using Abp.Domain.Entities;
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elicom.Entities
{
    public class StoreKyc : Entity<Guid>
    {
        [Required]
        public Guid StoreId { get; set; }

        public string FullName { get; set; }
        public string CNIC { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public string IssueCountry { get; set; }
        public DateTime? DOB { get; set; }
        public string Phone { get; set; }
        public string Address { get; set; }
        public string ZipCode { get; set; }
        public string FrontImage { get; set; }
        public string BackImage { get; set; }
        public bool Status { get; set; }

        [ForeignKey("StoreId")]
        public virtual Store Store { get; set; }
    }
}
