using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Stores.Dto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.Stores
{
    public interface IStoreAppService : IApplicationService
    {
        Task<StoreDto> Get(Guid id);
        Task<ListResultDto<StoreDto>> GetAll();
        Task<ListResultDto<StoreLookupDto>> GetStoreLookup();
        Task<StoreDto> Create(CreateStoreDto input);
        Task<StoreDto> Update(UpdateStoreDto input);
        Task Delete(Guid id);
        Task Approve(EntityDto<Guid> input);
        Task Reject(RejectStoreInput input);
        Task VerifyKyc(EntityDto<Guid> input);
        Task<StoreDto> GetMyStore();
        Task<bool> IsStoreNameAvailable(string name);
        Task ToggleAdminStatus(Guid storeId, bool isActive);
        Task SetFavorite(SetStoreFavoriteInput input);
        Task ToggleFavorite(EntityDto<Guid> input);
        Task UpdateWithdrawPermission(UpdateWithdrawPermissionInput input);
    }
}
