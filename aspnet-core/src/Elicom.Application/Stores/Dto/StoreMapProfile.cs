using AutoMapper;
using Elicom.Entities;
using Elicom.Stores.Dto;

public class StoreMapProfile : Profile
{
    public StoreMapProfile()
    {
        CreateMap<Store, StoreDto>().ReverseMap();
        CreateMap<CreateStoreDto, Store>().ReverseMap();
        CreateMap<UpdateStoreDto, Store>().ReverseMap();

        CreateMap<StoreKyc, StoreKycDto>().ReverseMap();
        CreateMap<CreateStoreKycDto, StoreKyc>().ReverseMap();
    }
}
