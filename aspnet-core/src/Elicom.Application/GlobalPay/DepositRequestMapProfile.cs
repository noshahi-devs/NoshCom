using AutoMapper;
using Elicom.Entities;
using Elicom.GlobalPay.Dto;

namespace Elicom.GlobalPay
{
    public class DepositRequestMapProfile : Profile
    {
        public DepositRequestMapProfile()
        {
            CreateMap<DepositRequest, DepositRequestDto>()
                .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.User != null ? src.User.UserName : null))
                .ForMember(dest => dest.FullName, opt => opt.MapFrom(src => 
                    (src.User != null && !string.IsNullOrWhiteSpace(src.User.Name)) 
                    ? (src.User.Name + (string.IsNullOrWhiteSpace(src.User.Surname) ? "" : " " + src.User.Surname)) 
                    : (src.User != null ? src.User.UserName : "Unknown User")))
                .ForMember(dest => dest.Name, opt => opt.MapFrom(src => src.User != null ? src.User.Name : null))
                .ForMember(dest => dest.Surname, opt => opt.MapFrom(src => src.User != null ? src.User.Surname : null))
                .ForMember(dest => dest.LocalAmount, opt => opt.MapFrom(src => src.LocalAmount))
                .ForMember(dest => dest.LocalCurrency, opt => opt.MapFrom(src => src.LocalCurrency));
            
            CreateMap<CreateDepositRequestInput, DepositRequest>()
                .ForMember(dest => dest.LocalAmount, opt => opt.MapFrom(src => src.LocalAmount))
                .ForMember(dest => dest.LocalCurrency, opt => opt.MapFrom(src => src.LocalCurrency));
        }
    }
}
