using AutoMapper;
using Elicom.Entities;
using Elicom.Support.Dto;

namespace Elicom.Support
{
    public class SupportTicketMapProfile : Profile
    {
        public SupportTicketMapProfile()
        {
            CreateMap<SupportTicket, SupportTicketDto>()
                .ForMember(dto => dto.UserName, opt => opt.MapFrom(src => src.User != null ? src.User.UserName : (src.ContactName ?? "Anonymous")));
            
            CreateMap<CreateSupportTicketInput, SupportTicket>();
        }
    }
}
