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
                SourcePlatform = AbpSession.TenantId == 3 ? "EasyFinora" : "GlobalPay",
                DestinationAccount = GetDestinationAccountForCountry(input.Country),
                ReferenceId = input.ReferenceId
            };

            await _depositRequestRepository.InsertAsync(request);
            return ObjectMapper.Map<DepositRequestDto>(request);
        }

        public async Task<PagedResultDto<DepositRequestDto>> GetMyRequests(PagedAndSortedResultRequestDto input)
        {
            var user = await GetCurrentUserAsync();

            var query = _depositRequestRepository.GetAll()
                .Where(r => r.UserId == user.Id);

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreationTime)
                //.Skip(input.SkipCount)
                //.Take(input.MaxResultCount)
                .ToListAsync();

            return new PagedResultDto<DepositRequestDto>(
                totalCount,
                ObjectMapper.Map<List<DepositRequestDto>>(items)
            );
        }

        [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin)]
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

        [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin)]
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

        [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin)]
        public async Task Approve(ApproveDepositRequestInput input)
        {
            // Disable filters for admin to process any request
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant))
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var request = await _depositRequestRepository.GetAsync(input.Id);

                if (request.Status != "Pending")
                {
                    throw new UserFriendlyException("Only pending requests can be approved.");
                }

                request.Status = "Approved";
                request.AdminRemarks = input.AdminRemarks;

                // ACTUAL DEPOSIT INTO WALLET (Existing GlobalPay logic)
                await _walletManager.DepositAsync(
                    request.UserId,
                    request.Amount,
                    request.Id.ToString(),
                    $"Manual Deposit Approved - Reference: {request.Id}"
                );

                // UPDATE VIRTUAL CARD BALANCE (New EasyFinora logic)
                if (request.CardId.HasValue)
                {
                    var card = await _cardRepository.GetAsync(request.CardId.Value);
                    card.Balance += request.Amount;

                    // RECORD TRANSACTION
                    await _transactionRepository.InsertAsync(new AppTransaction
                    {
                        UserId = request.UserId,
                        CardId = request.CardId,
                        Amount = request.Amount,
                        MovementType = "Credit",
                        Category = "Deposit",
                        ReferenceId = request.Id.ToString(),
                        Description = $"Deposit Approved for Card {request.CardId}"
                    });
                }
            }
        }

        [AbpAuthorize(PermissionNames.Pages_GlobalPay_Admin)]
        public async Task Reject(ApproveDepositRequestInput input)
        {
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant))
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var request = await _depositRequestRepository.GetAsync(input.Id);

                if (request.Status != "Pending")
                {
                    throw new UserFriendlyException("Only pending requests can be rejected.");
                }

                request.Status = "Rejected";
                request.AdminRemarks = input.AdminRemarks;
            }
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
