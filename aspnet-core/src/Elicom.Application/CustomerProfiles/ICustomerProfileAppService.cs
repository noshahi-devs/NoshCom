using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.CustomerProfiles.Dto;
using System;
using System.Threading.Tasks;

namespace Elicom.CustomerProfiles
{
    public interface ICustomerProfileAppService : IApplicationService
    {
        Task<CustomerProfileDto> CreateAsync(CreateCustomerProfileDto input);

        Task<CustomerProfileDto> UpdateAsync(UpdateCustomerProfileDto input);

        Task<CustomerProfileDto> GetByUserIdAsync(long userId);

        Task<CustomerProfileDto> GetMyProfileAsync();

        Task DeleteAsync(Guid id);
    }
}
