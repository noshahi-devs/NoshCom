using AutoMapper;
using Elicom.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.Products.Dto
{

    public class ProductMapProfile : Profile
    {
        public ProductMapProfile()
        {
            CreateMap<Product, ProductDto>()
                .ForMember(dest => dest.CategoryName,
                    opt => opt.MapFrom(src => src.Category.Name))
                .ForMember(dest => dest.SupplierPrice,
                    opt => opt.MapFrom(src => ResolveSupplierPrice(src)));

            CreateMap<CreateProductDto, Product>();
            CreateMap<UpdateProductDto, Product>();
        }

        private static decimal ResolveSupplierPrice(Product product)
        {
            var resellerMaxPrice = Math.Max(0m, product.ResellerMaxPrice);
            var discountPercentage = Math.Clamp(product.DiscountPercentage, 0m, 100m);
            var discounted = resellerMaxPrice - (resellerMaxPrice * discountPercentage / 100m);

            if (discounted > 0m || resellerMaxPrice > 0m)
            {
                return Math.Round(Math.Max(discounted, 0m), 2, MidpointRounding.AwayFromZero);
            }

            return Math.Round(Math.Max(product.SupplierPrice, 0m), 2, MidpointRounding.AwayFromZero);
        }
    }

}
