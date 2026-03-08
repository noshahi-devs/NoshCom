using AutoMapper;
using Elicom.Entities;

namespace Elicom.Carts.Dto
{
    public class CartMapProfile : Profile
    {
        public CartMapProfile()
        {
            CreateMap<CartItem, CartItemDto>()
                .ForMember(dest => dest.ProductTitle, opt => opt.MapFrom(src => src.StoreProduct != null && src.StoreProduct.Product != null ? src.StoreProduct.Product.Name : "Unknown Product"))
                .ForMember(dest => dest.ProductImage, opt => opt.MapFrom(src => src.StoreProduct != null && src.StoreProduct.Product != null ? src.StoreProduct.Product.Images : ""))
                .ForMember(dest => dest.StoreName, opt => opt.MapFrom(src => src.StoreProduct != null && src.StoreProduct.Store != null ? src.StoreProduct.Store.Name : "Unknown Store"));

            CreateMap<CreateCartItemDto, CartItem>()
                .ForMember(dest => dest.Status, opt => opt.MapFrom(src => "Active"));
        }
    }
}
