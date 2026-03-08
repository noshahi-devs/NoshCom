using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.ComponentModel.DataAnnotations;


namespace Elicom.Stores.Dto
{
    public class CreateStoreDto
    {
        [Required]
        public string Name { get; set; }

        [Required]
        public long OwnerId { get; set; } // Can be current logged-in user

        public string ShortDescription { get; set; }
        public string LongDescription { get; set; }
        public string Description { get; set; }
        public string Slug { get; set; }
        public string SupportEmail { get; set; }
        public bool Status { get; set; }
        public bool IsActive { get; set; } = true;

        public CreateStoreKycDto Kyc { get; set; }
    }

    public class CreateStoreKycDto
    {
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
    }
}
