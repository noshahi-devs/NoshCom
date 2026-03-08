using AutoMapper;
using Elicom.Entities;
using Elicom.SupplierOrders.Dto;

namespace Elicom.SupplierOrders
{
    public class SupplierOrderMapProfile : Profile
    {
        public SupplierOrderMapProfile()
        {
            CreateMap<SupplierOrder, SupplierOrderDto>()
                .ForMember(dto => dto.SellerName, opt => opt.MapFrom(src => src.Reseller != null ? src.Reseller.Name + " " + src.Reseller.Surname : "Unknown"))
                .ForMember(dto => dto.SellerId, opt => opt.MapFrom(src => src.ResellerId));
            CreateMap<SupplierOrderItem, SupplierOrderItemDto>()
                .ForMember(dto => dto.ProductName, opt => opt.MapFrom(src => src.Product != null ? src.Product.Name : string.Empty));

            CreateMap<CreateSupplierOrderDto, SupplierOrder>();
            CreateMap<CreateSupplierOrderItemDto, SupplierOrderItem>();
        }
    }
}
