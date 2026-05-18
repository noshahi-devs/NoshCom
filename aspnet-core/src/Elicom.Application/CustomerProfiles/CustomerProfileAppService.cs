using Abp.Application.Services;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Elicom.Authorization;
using Elicom.CustomerProfiles.Dto;
using Elicom.Entities;
using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Abp.Runtime.Session;

namespace Elicom.CustomerProfiles
{
    [AbpAuthorize]
    public class CustomerProfileAppService
        : ApplicationService, ICustomerProfileAppService
    {
        private readonly IRepository<CustomerProfile, Guid> _customerProfileRepository;

        public CustomerProfileAppService(
            IRepository<CustomerProfile, Guid> customerProfileRepository)
        {
            _customerProfileRepository = customerProfileRepository;
        }

        // CREATE
        public async Task<CustomerProfileDto> CreateAsync(CreateCustomerProfileDto input)
        {
            var currentUserId = AbpSession.GetUserId();
            var isAdmin = await IsCurrentUserAdminAsync();
            if (!isAdmin || input.UserId <= 0)
            {
                input.UserId = currentUserId;
            }

            var existingProfile = await _customerProfileRepository
                .FirstOrDefaultAsync(x => x.UserId == input.UserId);

            if (existingProfile != null)
            {
                throw new UserFriendlyException("Customer profile already exists.");
            }

            var entity = ObjectMapper.Map<CustomerProfile>(input);
            entity = await _customerProfileRepository.InsertAsync(entity);

            return ObjectMapper.Map<CustomerProfileDto>(entity);
        }

        // UPDATE
        public async Task<CustomerProfileDto> UpdateAsync(UpdateCustomerProfileDto input)
        {
            var profile = await _customerProfileRepository.GetAsync(input.Id);
            var currentUserId = AbpSession.GetUserId();
            if (!await IsCurrentUserAdminAsync() && profile.UserId != currentUserId)
            {
                throw new UserFriendlyException("Unauthorized access to this profile.");
            }

            ObjectMapper.Map(input, profile);
            await _customerProfileRepository.UpdateAsync(profile);

            return ObjectMapper.Map<CustomerProfileDto>(profile);
        }

        // GET BY USER
        public async Task<CustomerProfileDto> GetByUserIdAsync(long userId)
        {
            var currentUserId = AbpSession.GetUserId();
            if (!await IsCurrentUserAdminAsync() && userId != currentUserId)
            {
                throw new UserFriendlyException("Unauthorized access to this profile.");
            }

            var profile = await _customerProfileRepository
                .GetAll()
                .FirstOrDefaultAsync(x => x.UserId == userId);

            if (profile == null)
            {
                return null;
            }

            return ObjectMapper.Map<CustomerProfileDto>(profile);
        }

        // GET MY PROFILE
        public async Task<CustomerProfileDto> GetMyProfileAsync()
        {
            var userId = AbpSession.GetUserId();
            var profile = await _customerProfileRepository
                .GetAll()
                .FirstOrDefaultAsync(x => x.UserId == userId);

            if (profile == null)
            {
                return new CustomerProfileDto { UserId = userId };
            }

            return ObjectMapper.Map<CustomerProfileDto>(profile);
        }

        // DELETE
        public async Task DeleteAsync(Guid id)
        {
            var profile = await _customerProfileRepository.GetAsync(id);
            var currentUserId = AbpSession.GetUserId();
            if (!await IsCurrentUserAdminAsync() && profile.UserId != currentUserId)
            {
                throw new UserFriendlyException("Unauthorized access to this profile.");
            }

            await _customerProfileRepository.DeleteAsync(id);
        }

        private async Task<bool> IsCurrentUserAdminAsync()
        {
            return await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_Users)
                || await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_SmartStore_Admin)
                || await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_PrimeShip_Admin)
                || await PermissionChecker.IsGrantedAsync(PermissionNames.Admin);
        }
    }
}
