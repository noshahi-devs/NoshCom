using AutoMapper;
using Elicom.Cards.Dto;
using Elicom.Cards;

namespace Elicom.Cards.Dto
{
    public class CardMapProfile : Profile
    {
        public CardMapProfile()
        {
            CreateMap<CardApplication, CardApplicationDto>()
                .ForMember(d => d.UserName, o => o.MapFrom(s => s.User.UserName));
            
            CreateMap<SubmitCardApplicationInput, CardApplication>();
        }
    }
}
