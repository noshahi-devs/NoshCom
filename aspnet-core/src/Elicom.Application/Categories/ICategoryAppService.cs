using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Categories.Dto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.Categories
{
    public interface ICategoryAppService : IApplicationService
    {
        Task<CategoryDto> Get(Guid id);
        Task<ListResultDto<CategoryDto>> GetAll(int maxResultCount = 100);
        Task<CategoryDto> Create(CreateCategoryDto input);
        Task<CategoryDto> Update(UpdateCategoryDto input);
        Task<ListResultDto<CategoryLookupDto>> GetLookup();
        Task Delete(Guid id, bool forceDelete = false);
    }
}
