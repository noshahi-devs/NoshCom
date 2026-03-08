using AutoMapper;
using Elicom.Entities;
using Elicom.CustomerProfiles.Dto;

namespace Elicom.CustomerProfiles
{
    public class CustomerProfileMapProfile : Profile
    {
        public CustomerProfileMapProfile()
        {
            CreateMap<CustomerProfile, CustomerProfileDto>();
            CreateMap<CreateCustomerProfileDto, CustomerProfile>();
            CreateMap<UpdateCustomerProfileDto, CustomerProfile>();
        }
    }
}
