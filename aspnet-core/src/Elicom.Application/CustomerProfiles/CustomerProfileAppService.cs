using Abp.Application.Services;
using Abp.Domain.Repositories;
using Abp.UI;
using AutoMapper;
using Elicom.CustomerProfiles.Dto;
using Elicom.Entities;
using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Abp.Runtime.Session;

namespace Elicom.CustomerProfiles
{
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

            ObjectMapper.Map(input, profile);
            await _customerProfileRepository.UpdateAsync(profile);

            return ObjectMapper.Map<CustomerProfileDto>(profile);
        }

        // GET BY USER
        public async Task<CustomerProfileDto> GetByUserIdAsync(long userId)
        {
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
                // Optionally create one if it doesn't exist?
                // For now, return null or empty DTO to avoid error in frontend
                return new CustomerProfileDto { UserId = userId };
            }

            return ObjectMapper.Map<CustomerProfileDto>(profile);
        }

        // DELETE
        public async Task DeleteAsync(Guid id)
        {
            await _customerProfileRepository.DeleteAsync(id);
        }
    }
}
