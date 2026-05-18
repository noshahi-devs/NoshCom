using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Products.Dto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.Products
{
    public interface IProductAppService : IApplicationService
    {
        Task<ListResultDto<ProductDto>> GetAll();
        Task<ListResultDto<ProductDto>> GetByCategory(Guid categoryId);
        Task<ListResultDto<ProductDto>> Search(string query);
        Task<ProductDto> Create(CreateProductDto input);
        Task<ProductDto> Update(UpdateProductDto input);
        Task Delete(Guid id);
    }

}
