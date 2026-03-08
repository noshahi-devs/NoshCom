using Abp.Application.Services.Dto;
using System;

namespace Elicom.CustomerProfiles.Dto
{
    public class CustomerProfileDto : EntityDto<Guid>
    {
        public long UserId { get; set; }
        public string FullName { get; set; }
        public string PhoneNumber { get; set; }
        public string Email { get; set; }

        public string AddressLine1 { get; set; }
        public string AddressLine2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Country { get; set; }

        public string ProfilePictureUrl { get; set; }
    }
}
