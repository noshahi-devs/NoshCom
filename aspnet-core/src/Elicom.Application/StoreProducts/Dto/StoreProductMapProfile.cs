using AutoMapper;
using Elicom.Entities;
using Elicom.StoreProducts.Dto;

public class StoreProductMapProfile : Profile
{
    public StoreProductMapProfile()
    {
        CreateMap<StoreProduct, StoreProductDto>()
            .ForMember(d => d.ProductName,
                o => o.MapFrom(s => s.Product.Name))
            .ForMember(d => d.ProductImage,
                o => o.MapFrom(s => s.Product.Images))
            .ForMember(d => d.BrandName,
                o => o.MapFrom(s => s.Product.BrandName));

        CreateMap<CreateStoreProductDto, StoreProduct>();
        CreateMap<UpdateStoreProductDto, StoreProduct>();
    }
}
