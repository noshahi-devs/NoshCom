using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Elicom.Authorization;
using Elicom.Entities;
using Elicom.GlobalPay.Dto;
using Elicom.Wallets;
using Elicom.Cards;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.GlobalPay
{
    [AbpAuthorize]
    public class DepositRequestAppService : ElicomAppServiceBase, IDepositRequestAppService
    {
        private readonly IRepository<DepositRequest, Guid> _depositRequestRepository;
        private readonly IWalletManager _walletManager;
        private readonly IRepository<AppTransaction, long> _transactionRepository;
        private readonly IRepository<VirtualCard, long> _cardRepository;

        public DepositRequestAppService(
            IRepository<DepositRequest, Guid> depositRequestRepository,
            IWalletManager walletManager,
            IRepository<VirtualCard, long> cardRepository,
            IRepository<AppTransaction, long> transactionRepository)
        {
            _depositRequestRepository = depositRequestRepository;
            _walletManager = walletManager;
            _cardRepository = cardRepository;
            _transactionRepository = transactionRepository;
        }

        public async Task<DepositRequestDto> Create(CreateDepositRequestInput input)
        {
            var user = await GetCurrentUserAsync();

            if (!AbpSession.TenantId.HasValue)
            {
                throw new UserFriendlyException("Tenant is required to create a deposit request.");
            }

            var request = new DepositRequest
            {
                TenantId = AbpSession.TenantId.Value,
                UserId = user.Id,
                CardId = input.CardId,
                Amount = input.Amount,
                LocalAmount = input.LocalAmount,
                LocalCurrency = input.LocalCurrency,
                Country = input.Country,
                ProofImage = input.ProofImage,
                Status = "Pending",
                Method = input.Method ?? "P2P",
                SourcePlatform = GetSourcePlatform(AbpSession.TenantId),
                DestinationAccount = GetDestinationAccountForCountry(input.Country),
                ReferenceId = input.ReferenceId
            };

            await _depositRequestRepository.InsertAsync(request);
            return ObjectMapper.Map<DepositRequestDto>(request);
        }

        public async Task<PagedResultDto<DepositRequestDto>> GetMyRequests(PagedAndSortedResultRequestDto input)
        {
            var user = await GetCurrentUserAsync();
            var linkedUserIds = await GetGlobalMartLinkedUserIdsAsync(user);

            var query = _depositRequestRepository.GetAll()
                .Where(r => linkedUserIds.Contains(r.UserId));

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreationTime)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount)
                .ToListAsync();

            return new PagedResultDto<DepositRequestDto>(
                totalCount,
                ObjectMapper.Map<List<DepositRequestDto>>(items)
            );
        }

        [AbpAuthorize(
            PermissionNames.Admin,
            PermissionNames.Pages_GlobalPay_Admin,
            PermissionNames.Pages_PrimeShip_Admin,
            PermissionNames.Pages_SmartStore_Admin)]
        public async Task<PagedResultDto<DepositRequestDto>> GetAllRequests(PagedAndSortedResultRequestDto input)
        {
            // Disable multi-tenancy filter so admin sees ALL records from ALL tenants
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant))
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var query = _depositRequestRepository.GetAll().Include(r => r.User);

                var totalCount = await query.CountAsync();

                // Use PROJECTION to exclude ProofImage from the DB query entirely (performance fix)
                var dtos = await query
                    .OrderByDescending(r => r.CreationTime) // Newest first
                    .Skip(input.SkipCount)
                    .Take(input.MaxResultCount)
                    .Select(r => new DepositRequestDto
                    {
                        Id = r.Id,
                        Amount = r.Amount,
                        LocalAmount = r.LocalAmount,
                        LocalCurrency = r.LocalCurrency,
                        Country = r.Country,
                        Status = r.Status,
                        Method = r.Method,
                        SourcePlatform = r.SourcePlatform,
                        DestinationAccount = r.DestinationAccount,
                        AdminRemarks = r.AdminRemarks,
                        CreationTime = r.CreationTime,
                        CardId = r.CardId,
                        ReferenceId = r.ReferenceId,
                        ProofImage = null, // Never load from DB for list view - big performance gain
                        HasProof = r.ProofImage != null && r.ProofImage != "",
                        UserName = r.User != null ? r.User.EmailAddress : null,
                        Name = r.User != null ? r.User.Name : null,
                        Surname = r.User != null ? r.User.Surname : null,
                        FullName = r.User != null
                            ? ((r.User.Name + " " + r.User.Surname).Trim() != ""
                                ? (r.User.Name + " " + r.User.Surname).Trim()
                                : r.User.UserName)
                            : null
                    })
                    .ToListAsync();

                return new PagedResultDto<DepositRequestDto>(
                    totalCount,
                    dtos
                );
            }
        }

        [AbpAuthorize(
            PermissionNames.Admin,
            PermissionNames.Pages_GlobalPay_Admin,
            PermissionNames.Pages_PrimeShip_Admin,
            PermissionNames.Pages_SmartStore_Admin)]
        public async Task<string> GetProofImage(Guid id)
        {
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant))
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                // Efficiently fetch only the ProofImage column from the DB
                return await _depositRequestRepository.GetAll()
                    .Where(r => r.Id == id)
                    .Select(r => r.ProofImage)
                    .FirstOrDefaultAsync();
            }
        }

        [AbpAuthorize(
            PermissionNames.Admin,
            PermissionNames.Pages_GlobalPay_Admin,
            PermissionNames.Pages_PrimeShip_Admin,
            PermissionNames.Pages_SmartStore_Admin)]
        public async Task Approve(ApproveDepositRequestInput input)
        {
            if (input == null || input.Id == Guid.Empty)
            {
                throw new UserFriendlyException("Invalid deposit request id.");
            }

            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant))
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var request = await _depositRequestRepository.FirstOrDefaultAsync(input.Id);
                if (request == null)
                {
                    throw new UserFriendlyException("Deposit request was not found.");
                }

                if (!string.Equals(request.Status, "Pending", StringComparison.OrdinalIgnoreCase))
                {
                    throw new UserFriendlyException("Only pending requests can be approved.");
                }

                var requestingUser = await UserManager.Users
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(u => u.Id == request.UserId);

                if (requestingUser == null)
                {
                    throw new UserFriendlyException("Seller account for this deposit could not be found.");
                }

                var targetUserId = await ResolveGlobalMartUnifiedUserIdAsync(requestingUser);

                request.Status = "Approved";
                request.AdminRemarks = string.IsNullOrWhiteSpace(input.AdminRemarks)
                    ? "Approved"
                    : input.AdminRemarks.Trim();
                await _depositRequestRepository.UpdateAsync(request);

                using (CurrentUnitOfWork.SetTenantId(3))
                {
                    await _walletManager.DepositAsync(
                        targetUserId,
                        request.Amount,
                        request.Id.ToString(),
                        $"Manual Deposit Request"
                    );
                }

                await CurrentUnitOfWork.SaveChangesAsync();
            }
        }

        [AbpAuthorize(
            PermissionNames.Admin,
            PermissionNames.Pages_GlobalPay_Admin,
            PermissionNames.Pages_PrimeShip_Admin,
            PermissionNames.Pages_SmartStore_Admin)]
        public async Task Reject(ApproveDepositRequestInput input)
        {
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant))
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                if (input == null || input.Id == Guid.Empty)
                {
                    throw new UserFriendlyException("Invalid deposit request id.");
                }

                var request = await _depositRequestRepository.FirstOrDefaultAsync(input.Id);
                if (request == null)
                {
                    throw new UserFriendlyException("Deposit request was not found.");
                }

                if (!string.Equals(request.Status, "Pending", StringComparison.OrdinalIgnoreCase))
                {
                    throw new UserFriendlyException("Only pending requests can be rejected.");
                }

                request.Status = "Rejected";
                request.AdminRemarks = input.AdminRemarks;
                await _depositRequestRepository.UpdateAsync(request);
                await CurrentUnitOfWork.SaveChangesAsync();
            }
        }

        private static string GetSourcePlatform(int? tenantId)
        {
            return tenantId switch
            {
                3 => "EasyFinora",
                2 => "Global Mart UK",
                1 => "Smart Shop UK",
                _ => "GlobalPay"
            };
        }

        private string GetDestinationAccountForCountry(string country)
        {
            // Dummy logic: In a real app, this would come from settings or a separate entity
            if (string.IsNullOrWhiteSpace(country))
            {
                return "Central Global Account - Acc: 00000000";
            }

            return country.ToLower() switch
            {
                "uk" => "Barclays Bank - Acc: 12345678",
                "usa" => "Chase Bank - Acc: 98765432",
                _ => "Central Global Account - Acc: 00000000"
            };
        }
    }
}
