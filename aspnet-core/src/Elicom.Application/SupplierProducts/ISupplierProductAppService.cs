using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Products.Dto;
using System;
using System.Threading.Tasks;

namespace Elicom.SupplierProducts
{
    public interface ISupplierProductAppService : IApplicationService
    {
        Task<ListResultDto<ProductDto>> GetMyProducts();
        Task<ProductDto> GetProductForEdit(Guid id);
        Task<ProductDto> CreateProduct(CreateProductDto input);
        Task<ProductDto> UpdateProduct(UpdateProductDto input);
        Task DeleteProduct(Guid id);
    }
}
