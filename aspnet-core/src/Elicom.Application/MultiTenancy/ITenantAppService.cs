using Abp.Application.Services;
using Elicom.MultiTenancy.Dto;

namespace Elicom.MultiTenancy;

public interface ITenantAppService : IAsyncCrudAppService<TenantDto, int, PagedTenantResultRequestDto, CreateTenantDto, TenantDto>
{
}

