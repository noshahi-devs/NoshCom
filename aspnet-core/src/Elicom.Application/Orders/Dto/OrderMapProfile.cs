using AutoMapper;
using Elicom.Entities;
using Elicom.OrderItems.Dto;
using Elicom.Orders.Dto;
using System;
using System.Linq;

namespace Elicom.Orders
{
    public class OrderMapProfile : Profile
    {
        public OrderMapProfile()
        {
            CreateMap<Order, OrderDto>();
            CreateMap<SupplierOrder, OrderDto>()
                .ForMember(dest => dest.OrderNumber, opts => opts.MapFrom(src => src.ReferenceCode))
                .ForMember(dest => dest.TotalAmount, opts => opts.MapFrom(src => src.TotalPurchaseAmount));
            CreateMap<OrderItem, OrderItemDto>()
                .ForMember(dest => dest.ImageUrl, opts => opts.MapFrom<OrderItemImageUrlResolver>())
                .ForMember(dest => dest.ProductName, opts => opts.MapFrom(src =>
                    !string.IsNullOrWhiteSpace(src.ProductName)
                        ? src.ProductName
                        : (src.StoreProduct != null && src.StoreProduct.Product != null ? src.StoreProduct.Product.Name : "")))
                .ForMember(dest => dest.StoreName, opts => opts.MapFrom(src =>
                    !string.IsNullOrWhiteSpace(src.StoreName)
                        ? src.StoreName
                        : (src.StoreProduct != null && src.StoreProduct.Store != null ? src.StoreProduct.Store.Name : "")))
                .ForMember(dest => dest.ProductSlug, opts => opts.MapFrom(src => src.StoreProduct != null && src.StoreProduct.Product != null ? src.StoreProduct.Product.Slug : ""))
                .ForMember(dest => dest.StoreSlug, opts => opts.MapFrom(src => src.StoreProduct != null && src.StoreProduct.Store != null ? src.StoreProduct.Store.Slug : ""))
                .ForMember(dest => dest.OriginalPrice, opts => opts.MapFrom(src => src.OriginalPrice))
                .ForMember(dest => dest.DiscountPercentage, opts => opts.MapFrom(src => src.DiscountPercentage))
                .ForMember(dest => dest.CreationTime, opts => opts.MapFrom(src => src.Order != null ? src.Order.CreationTime : DateTime.Now));
        }
    }
}
