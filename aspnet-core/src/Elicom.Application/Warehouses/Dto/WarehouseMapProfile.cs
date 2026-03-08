using AutoMapper;
using Elicom.Entities;
using Elicom.Warehouses.Dto;

namespace Elicom.Warehouses.Dto
{
    public class WarehouseMapProfile : Profile
    {
        public WarehouseMapProfile()
        {
            CreateMap<Warehouse, WarehouseDto>();
            CreateMap<WarehouseDto, Warehouse>();
            CreateMap<CreateWarehouseInput, Warehouse>();
        }
    }
}
