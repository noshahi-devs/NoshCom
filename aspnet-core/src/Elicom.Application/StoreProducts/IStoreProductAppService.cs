using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.StoreProducts.Dto;
using System;
using System.Threading.Tasks;

namespace Elicom.StoreProducts
{   

    public interface IStoreProductAppService : IApplicationService
    {
        Task Create(CreateStoreProductDto input);
        Task MapProductToStore(MapProductDto input);
        Task<ListResultDto<StoreProductDto>> GetByStore(Guid storeId);
        Task<PagedResultDto<StoreProductDto>> GetPagedByStore(GetStoreProductsPagedInput input);
        Task Update(UpdateStoreProductDto input);
        Task Delete(Guid id);
    }

}
