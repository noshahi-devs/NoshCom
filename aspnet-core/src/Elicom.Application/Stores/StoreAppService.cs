using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Dependency;
using Elicom.Authorization;
using Elicom.Entities;
using Elicom.Common;
using Elicom.Stores.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Net;
using Abp.BackgroundJobs;
using Elicom.Authorization.Users;
using Elicom.BackgroundJobs;
using Elicom.Storage;

namespace Elicom.Stores
{    
    [AbpAuthorize]
    public class StoreAppService : ElicomAppServiceBase, IStoreAppService
    {
        private readonly IRepository<Store, Guid> _storeRepo;
        private readonly IRepository<User, long> _userRepo;
        private readonly IRepository<StoreKyc, Guid> _kycRepo;
        private readonly IRepository<StoreFavorite, Guid> _favoriteRepo;
        private readonly IBlobStorageService _blobStorageService;
        private readonly IRepository<SmartStoreWallet, Guid> _walletRepo;
        private readonly IBackgroundJobManager _backgroundJobManager;
        private readonly IRepository<StoreProduct, Guid> _spRepo;
        private readonly IRepository<Order, Guid> _orderRepo;
        private readonly IRepository<OrderItem, Guid> _orderItemRepo;

        public StoreAppService(
            IRepository<Store, Guid> storeRepo, 
            IRepository<User, long> userRepo,
            IRepository<StoreKyc, Guid> kycRepo,
            IRepository<StoreFavorite, Guid> favoriteRepo,
            IBlobStorageService blobStorageService,
            IRepository<SmartStoreWallet, Guid> walletRepo,
            IBackgroundJobManager backgroundJobManager,
            IRepository<StoreProduct, Guid> spRepo,
            IRepository<Order, Guid> orderRepo,
            IRepository<OrderItem, Guid> orderItemRepo)
        {
            _storeRepo = storeRepo;
            _userRepo = userRepo;
            _kycRepo = kycRepo;
            _favoriteRepo = favoriteRepo;
            _blobStorageService = blobStorageService;
            _walletRepo = walletRepo;
            _backgroundJobManager = backgroundJobManager;
            _spRepo = spRepo;
            _orderRepo = orderRepo;
            _orderItemRepo = orderItemRepo;
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_Users, PermissionNames.Admin)]
        public virtual async Task<ListResultDto<StoreDto>> GetAll()
        {
            try
            {
                using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
                {
                    // Fetch stores with pre-calculated counts in one pass to avoid N+1 and unit-of-work filter issues.
                    var currentUserId = AbpSession.UserId;
                    var favoriteStoreIds = currentUserId.HasValue
                        ? await _favoriteRepo.GetAll()
                            .Where(f => f.AdminUserId == currentUserId.Value)
                            .Select(f => f.StoreId)
                            .ToListAsync()
                        : new List<Guid>();

                    var stores = await (from s in _storeRepo.GetAll()
                                       join w in _walletRepo.GetAll() on s.OwnerId equals w.UserId into sw
                                       from w in sw.DefaultIfEmpty()
                                       orderby s.CreatedAt descending
                                       select new StoreDto
                                       {
                                           Id = s.Id,
                                           Name = s.Name,
                                           OwnerId = s.OwnerId,
                                           ShortDescription = s.ShortDescription,
                                           LongDescription = s.LongDescription,
                                           Description = s.Description,
                                           Slug = s.Slug,
                                           SupportEmail = s.SupportEmail,
                                           Status = s.Status,
                                           IsActive = s.IsActive,
                                           IsAdminActive = s.IsAdminActive,
                                           CreatedAt = s.CreatedAt,
                                           UpdatedAt = s.UpdatedAt,
                                           WithdrawLimit = w != null ? w.WithdrawLimit : null,
                                           WithdrawAllowedUntil = w != null ? w.WithdrawAllowedUntil : null,
                                           AdminWithdrawRemarks = w != null ? w.AdminWithdrawRemarks : null,
                                           WalletBalance = w != null ? w.Balance : 0,
                                           
                                           // Efficient counts
                                           TotalProducts = _spRepo.GetAll().Count(sp => sp.StoreId == s.Id),
                                           
                                           // Orders are linked via StoreProduct -> OrderItem -> Order
                                           TotalOrders = (from oi in _orderItemRepo.GetAll()
                                                         join sp in _spRepo.GetAll() on oi.StoreProductId equals sp.Id
                                                         where sp.StoreId == s.Id
                                                         select oi.OrderId).Distinct().Count(),

                                           ShippedOrders = (from oi in _orderItemRepo.GetAll()
                                                           join sp in _spRepo.GetAll() on oi.StoreProductId equals sp.Id
                                                           join o in _orderRepo.GetAll() on oi.OrderId equals o.Id
                                                           where sp.StoreId == s.Id && (o.Status == "Shipped" || o.Status == "Delivered")
                                                           select oi.OrderId).Distinct().Count(),

                                           Kyc = s.Kyc == null ? null : new StoreKycDto
                                           {
                                               Id = s.Kyc.Id,
                                               StoreId = s.Kyc.StoreId,
                                               FullName = s.Kyc.FullName,
                                               CNIC = s.Kyc.CNIC,
                                               ExpiryDate = s.Kyc.ExpiryDate,
                                               IssueCountry = s.Kyc.IssueCountry,
                                               DOB = s.Kyc.DOB,
                                               Phone = s.Kyc.Phone,
                                               Address = s.Kyc.Address,
                                               ZipCode = s.Kyc.ZipCode,
                                               FrontImage = null,
                                               BackImage = null,
                                               Status = s.Kyc.Status
                                           },
                                           IsFavorite = favoriteStoreIds.Contains(s.Id)
                                       }).ToListAsync();

                    Logger.Info($"[Store/GetAll] Final result count: {stores.Count}");
                    return new ListResultDto<StoreDto>(stores);
                }
            }
            catch (Exception ex)
            {
                Logger.Error($"[Store/GetAll] Error: {ex.Message}", ex);
                throw;
            }
        }

        [AbpAuthorize]
        [Microsoft.AspNetCore.Mvc.HttpGet]
        public virtual async Task<ListResultDto<StoreLookupDto>> GetStoreLookup()
        {
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var stores = await _storeRepo.GetAll()
                    .Where(s => s.IsActive && s.IsAdminActive)
                    .Select(s => new StoreLookupDto
                    {
                        Id = s.Id,
                        Name = s.Name
                    })
                    .OrderBy(s => s.Name)
                    .ToListAsync();

                return new ListResultDto<StoreLookupDto>(stores);
            }
        }

        [AbpAuthorize]
        public virtual async Task<StoreDto> Get(Guid id)
        {
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var store = await (from s in _storeRepo.GetAll()
                                   join w in _walletRepo.GetAll() on s.OwnerId equals w.UserId into sw
                                   from w in sw.DefaultIfEmpty()
                                   where s.Id == id
                                   select new StoreDto
                                   {
                                       Id = s.Id,
                                       Name = s.Name,
                                       OwnerId = s.OwnerId,
                                       ShortDescription = s.ShortDescription,
                                       LongDescription = s.LongDescription,
                                       Description = s.Description,
                                       Slug = s.Slug,
                                       SupportEmail = s.SupportEmail,
                                       Status = s.Status,
                                       IsActive = s.IsActive,
                                       IsAdminActive = s.IsAdminActive,
                                       CreatedAt = s.CreatedAt,
                                       UpdatedAt = s.UpdatedAt,
                                       WithdrawLimit = w != null ? w.WithdrawLimit : null,
                                       WithdrawAllowedUntil = w != null ? w.WithdrawAllowedUntil : null,
                                       AdminWithdrawRemarks = w != null ? w.AdminWithdrawRemarks : null,
                                       Kyc = s.Kyc == null ? null : new StoreKycDto
                                       {
                                           Id = s.Kyc.Id,
                                           StoreId = s.Kyc.StoreId,
                                           FullName = s.Kyc.FullName,
                                           CNIC = s.Kyc.CNIC,
                                           ExpiryDate = s.Kyc.ExpiryDate,
                                           IssueCountry = s.Kyc.IssueCountry,
                                           DOB = s.Kyc.DOB,
                                           Phone = s.Kyc.Phone,
                                           Address = s.Kyc.Address,
                                           ZipCode = s.Kyc.ZipCode,
                                           FrontImage = s.Kyc.FrontImage,
                                           BackImage = s.Kyc.BackImage,
                                           Status = s.Kyc.Status
                                       }
                                   }).FirstOrDefaultAsync();

                if (store == null)
                    throw new Abp.UI.UserFriendlyException("Store not found.");

                // If Kyc is null after projection, try to fetch it directly from KycRepo
                if (store.Kyc == null)
                {
                    // 1. Try by StoreId
                    var kyc = await _kycRepo.FirstOrDefaultAsync(k => k.StoreId == id);
                    
                    if (kyc == null)
                    {
                        var orphans = await _kycRepo.GetAllListAsync(k => k.StoreId == Guid.Empty);
                        if (orphans.Any())
                        {
                           kyc = orphans.OrderByDescending(o => o.Id).FirstOrDefault();
                           if (kyc != null)
                           {
                               kyc.StoreId = id;
                               await _kycRepo.UpdateAsync(kyc);
                               Logger.Info($"[Store/Get] Healed KYC link for store {id}");
                           }
                        }
                    }

                    if (kyc != null)
                    {
                        store.Kyc = ObjectMapper.Map<StoreKycDto>(kyc);
                    }
                }

                return store;
            }
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_Users, PermissionNames.Admin)]
        public virtual async Task ToggleAdminStatus(Guid storeId, bool isActive)
        {
            var store = await _storeRepo.GetAsync(storeId);
            store.IsAdminActive = isActive;
            await _storeRepo.UpdateAsync(store);
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_Users, PermissionNames.Admin)]
        public virtual async Task SetFavorite(SetStoreFavoriteInput input)
        {
            if (!AbpSession.UserId.HasValue)
            {
                throw new Abp.UI.UserFriendlyException("User not found.");
            }

            if (input == null || input.Id == Guid.Empty)
            {
                throw new Abp.UI.UserFriendlyException("Store ID is required.");
            }

            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var adminUserId = AbpSession.UserId.Value;
                var favorite = await _favoriteRepo.FirstOrDefaultAsync(f =>
                    f.AdminUserId == adminUserId && f.StoreId == input.Id);

                if (input.IsFavorite)
                {
                    if (favorite == null)
                    {
                        await _favoriteRepo.InsertAsync(new StoreFavorite
                        {
                            Id = Guid.NewGuid(),
                            AdminUserId = adminUserId,
                            StoreId = input.Id,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    return;
                }

                if (favorite != null)
                {
                    await _favoriteRepo.DeleteAsync(favorite);
                }
            }
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_Users, PermissionNames.Admin)]
        public virtual async Task ToggleFavorite(EntityDto<Guid> input)
        {
            if (!AbpSession.UserId.HasValue)
            {
                throw new Abp.UI.UserFriendlyException("User not found.");
            }

            if (input == null || input.Id == Guid.Empty)
            {
                throw new Abp.UI.UserFriendlyException("Store ID is required.");
            }

            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var adminUserId = AbpSession.UserId.Value;
                var favorite = await _favoriteRepo.FirstOrDefaultAsync(f =>
                    f.AdminUserId == adminUserId && f.StoreId == input.Id);

                if (favorite != null)
                {
                    await _favoriteRepo.DeleteAsync(favorite);
                    return;
                }

                await _favoriteRepo.InsertAsync(new StoreFavorite
                {
                    Id = Guid.NewGuid(),
                    AdminUserId = adminUserId,
                    StoreId = input.Id,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_Users, PermissionNames.Admin)]
        public virtual async Task UpdateWithdrawPermission(UpdateWithdrawPermissionInput input)
        {

            var store = await _storeRepo.GetAsync(input.StoreId);
            var wallet = await _walletRepo.FirstOrDefaultAsync(w => w.UserId == store.OwnerId);
            if (wallet == null)
            {
                wallet = new SmartStoreWallet
                {
                    Id = Guid.NewGuid(),
                    UserId = store.OwnerId,
                    Balance = 0,
                    Currency = "USD"
                };
                await _walletRepo.InsertAsync(wallet);
            }

            wallet.WithdrawLimit = input.WithdrawLimit;
            wallet.WithdrawAllowedUntil = input.WithdrawAllowedUntil;
            wallet.AdminWithdrawRemarks = input.AdminWithdrawRemarks;
            await _walletRepo.UpdateAsync(wallet);
        }

        [AbpAuthorize]
        public async Task<StoreDto> Create(CreateStoreDto input)
        {
            if (string.IsNullOrWhiteSpace(input?.Name))
            {
                throw new Abp.UI.UserFriendlyException("Store name is required.");
            }

            input.Name = NormalizeStoreName(input.Name);
            var isNameAvailable = await IsStoreNameAvailableInternalAsync(input.Name);
            if (!isNameAvailable)
            {
                throw new Abp.UI.UserFriendlyException("Store name already exists. Please choose a different store name.");
            }

            if (input.Kyc != null)
            {
                var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
                input.Kyc.FrontImage = await ProcessKycImage(input.Kyc.FrontImage, input.Name, "Front", timestamp);
                input.Kyc.BackImage = await ProcessKycImage(input.Kyc.BackImage, input.Name, "Back", timestamp);
            }

            // Resolve owner from current session first, fallback to payload for compatibility.
            // Query with tenant filters disabled to avoid false negatives due tenant/session scope mismatches.
            var ownerId = AbpSession.UserId ?? input.OwnerId;
            User owner;
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                owner = await _userRepo.FirstOrDefaultAsync(u => u.Id == ownerId);
            }

            if (owner == null)
            {
                throw new Abp.UI.UserFriendlyException($"Owner account not found for UserId={ownerId}. Please sign in again.");
            }

            if (AbpSession.TenantId.HasValue && owner.TenantId != AbpSession.TenantId)
            {
                throw new Abp.UI.UserFriendlyException("Account is not valid for the current platform/tenant. Please sign in with the correct platform account.");
            }

            var store = ObjectMapper.Map<Store>(input);
            
            // Generate ID manually to ensure navigation properties are linked correctly
            if (store.Id == Guid.Empty)
            {
                store.Id = Guid.NewGuid();
            }

            store.CreatedAt = DateTime.Now;
            store.UpdatedAt = DateTime.Now;
            
            // Force resolved owner for security and FK consistency
            store.OwnerId = owner.Id;
            store.Status = false; // Pending admin approval until reviewed via Approve()/Reject()

            // Ensure relationship is linked correctly for EF
            if (store.Kyc != null)
            {
                store.Kyc.StoreId = store.Id;
                if (store.Kyc.Id == Guid.Empty)
                {
                    store.Kyc.Id = Guid.NewGuid();
                }
            }

            await _storeRepo.InsertAsync(store);

            // DISABLED per request: S1 (Store application received)
            // try
            // {
            //     await QueueStoreApplicationReceivedEmailAsync(store, owner);
            // }
            // catch (Exception ex)
            // {
            //     Logger.Warn($"[Store/Create] Could not enqueue store application email for store {store.Id}: {ex.Message}");
            // }

            return ObjectMapper.Map<StoreDto>(store);
        }

        [AbpAuthorize]
        [Microsoft.AspNetCore.Mvc.HttpGet]
        public virtual async Task<bool> IsStoreNameAvailable(string name)
        {
            return await IsStoreNameAvailableInternalAsync(name);
        }

        [AbpAuthorize(PermissionNames.Pages_Stores_Edit)]
        public async Task<StoreDto> Update(UpdateStoreDto input)
        {
            // Note: UpdateStoreDto doesn't currently include KYC, but if it did, 
            // we would process images here as well if they were passed.
            
            var store = await _storeRepo.GetAsync(input.Id);
            ObjectMapper.Map(input, store);
            return ObjectMapper.Map<StoreDto>(store);
        }

        [AbpAuthorize(PermissionNames.Pages_Stores_Delete)]
        public async Task Delete(Guid id)
        {
            await _storeRepo.DeleteAsync(id);
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_Users, PermissionNames.Admin)]
        public virtual async Task Approve(EntityDto<Guid> input)
        {
            var store = await _storeRepo.GetAsync(input.Id);
            
            store.Status = true;
            await _storeRepo.UpdateAsync(store);

            try
            {
                await QueueStoreDecisionEmailAsync(store, approved: true, reason: null);
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Store/Approve] Could not enqueue approval email for store {store.Id}: {ex.Message}");
            }
        }


        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_Users, PermissionNames.Admin)]
        public virtual async Task Reject(RejectStoreInput input)
        {
            if (input == null || input.Id == Guid.Empty)
            {
                throw new Abp.UI.UserFriendlyException("Store ID is required.");
            }

            var store = await _storeRepo.GetAsync(input.Id);
            store.Status = false;
            await _storeRepo.UpdateAsync(store);

            try
            {
                await QueueStoreDecisionEmailAsync(store, approved: false, reason: input.Reason);
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Store/Reject] Could not enqueue rejection email for store {store.Id}: {ex.Message}");
            }
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_Users, PermissionNames.Admin)]
        public virtual async Task VerifyKyc(EntityDto<Guid> input)
        {
            var user = await GetCurrentUserAsync();
            var store = await _storeRepo.GetAllIncluding(s => s.Kyc).FirstOrDefaultAsync(s => s.Id == input.Id);
            if (store != null && store.Kyc != null)
            {
                store.Kyc.Status = true;
                await _storeRepo.UpdateAsync(store);
            }
        }

        [AbpAuthorize]
        public virtual async Task<StoreDto> GetMyStore()
        {
            var userId = AbpSession.UserId;
            Logger.Info($"[GetMyStore] Request by User ID: {userId}, Tenant ID: {AbpSession.TenantId}");

            if (!userId.HasValue) 
            {
                Logger.Warn("[GetMyStore] AbpSession.UserId is null!");
                return null;
            }

            using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var store = await _storeRepo.GetAll()
                    .Include(s => s.Kyc)
                    .FirstOrDefaultAsync(s => s.OwnerId == userId.Value);

                if (store == null) 
                {
                    Logger.Warn($"[GetMyStore] No store found for User {userId}.");
                    return null;
                }

                Logger.Info($"[GetMyStore] Found store '{store.Name}' (ID: {store.Id})");
                var dto = ObjectMapper.Map<StoreDto>(store);

                // Attach withdrawal permissions from SmartStoreWallet
                var wallet = await _walletRepo.FirstOrDefaultAsync(w => w.UserId == userId.Value);
                if (wallet != null)
                {
                    dto.WithdrawLimit = wallet.WithdrawLimit;
                    dto.WithdrawAllowedUntil = wallet.WithdrawAllowedUntil;
                    dto.AdminWithdrawRemarks = wallet.AdminWithdrawRemarks;
                    dto.WalletBalance = wallet.Balance;
                }

                return dto;
            }
        }

        private async Task QueueStoreApplicationReceivedEmailAsync(Store store, User owner)
        {
            if (store == null || owner == null || string.IsNullOrWhiteSpace(owner.EmailAddress))
            {
                return;
            }

            var branding = ResolvePlatformBranding(owner.TenantId);
            var ownerName = string.IsNullOrWhiteSpace(owner.Name) ? owner.UserName : owner.Name;
            var subject = $"We Received Your Store Application - {branding.PlatformName}";
            var body = BuildStoreApplicationReceivedEmailBody(
                branding.PlatformName,
                branding.BrandColor,
                branding.SupportEmail,
                branding.FooterBrand,
                branding.FooterCompany,
                ownerName,
                store.Name);

            await EnqueuePlatformEmailAsync(branding.PlatformName, owner.EmailAddress, subject, body);
        }

        private async Task QueueStoreDecisionEmailAsync(Store store, bool approved, string reason)
        {
            if (store == null)
            {
                return;
            }

            User owner;
            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                owner = await _userRepo.FirstOrDefaultAsync(u => u.Id == store.OwnerId);
            }

            if (owner == null || string.IsNullOrWhiteSpace(owner.EmailAddress))
            {
                return;
            }

            var branding = ResolvePlatformBranding(owner.TenantId);
            var ownerName = string.IsNullOrWhiteSpace(owner.Name) ? owner.UserName : owner.Name;
            var subject = approved
                ? $"Your Store Application Has Been Approved - {branding.PlatformName}"
                : $"Update Needed: Your Store Application Was Not Approved - {branding.PlatformName}";
            var body = BuildStoreDecisionEmailBody(
                branding.PlatformName,
                branding.BrandColor,
                branding.SupportEmail,
                branding.FooterBrand,
                branding.FooterCompany,
                ownerName,
                store.Name,
                approved,
                reason);

            await EnqueuePlatformEmailAsync(branding.PlatformName, owner.EmailAddress, subject, body);
        }

        private static string NormalizeStoreName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return string.Empty;
            }

            return string.Join(" ", name.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)).Trim();
        }

        private async Task<bool> IsStoreNameAvailableInternalAsync(string name, Guid? excludeStoreId = null)
        {
            var normalizedName = NormalizeStoreName(name);
            if (string.IsNullOrWhiteSpace(normalizedName))
            {
                return false;
            }

            using (CurrentUnitOfWork.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
            {
                var existingNames = await _storeRepo.GetAll()
                    .Where(s => s.Name != null && (!excludeStoreId.HasValue || s.Id != excludeStoreId.Value))
                    .Select(s => s.Name)
                    .ToListAsync();

                var exists = existingNames.Any(existingName =>
                    string.Equals(
                        NormalizeStoreName(existingName),
                        normalizedName,
                        StringComparison.OrdinalIgnoreCase));

                return !exists;
            }
        }

        private async Task EnqueuePlatformEmailAsync(string platformName, string to, string subject, string htmlBody)
        {
            await _backgroundJobManager.EnqueueAsync<PlatformEmailJob, PlatformEmailJobArgs>(
                new PlatformEmailJobArgs
                {
                    PlatformName = platformName,
                    To = to,
                    Subject = subject,
                    HtmlBody = htmlBody
                });
        }

        private static (string PlatformName, string BrandColor, string SupportEmail, string FooterBrand, string FooterCompany) ResolvePlatformBranding(int? tenantId)
        {
            return tenantId switch
            {
                2 => EmailBrandingHelper.Resolve("PrimeShip"),
                3 => EmailBrandingHelper.Resolve("EasyFinora"),
                _ => EmailBrandingHelper.Resolve("SmartStore")
            };
        }

        private static string BuildStoreApplicationReceivedEmailBody(
            string platformName,
            string brandColor,
            string supportEmail,
            string footerBrand,
            string footerCompany,
            string ownerName,
            string storeName)
        {
            return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin:0; padding:0; background:#f3f4f6; font-family: Arial, Helvetica, sans-serif;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='padding:24px 12px;'>
        <tr>
            <td align='center'>
                <table width='600' cellpadding='0' cellspacing='0' style='max-width:600px; width:100%; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;'>
                    <tr>
                        <td style='background:{brandColor}; padding:24px 20px; text-align:center;'>
                            <h1 style='margin:0; color:{EmailBrandingHelper.GetHeroTextColor(brandColor)}; font-size:34px; font-weight:700;'>Store Application Received</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding:28px 24px; color:#111827; font-size:15px; line-height:1.55;'>
                            <p style='margin:0 0 14px;'>Dear {WebUtility.HtmlEncode(ownerName)},</p>
                            <p style='margin:0 0 14px;'>Thank you for submitting your store application on <strong>{WebUtility.HtmlEncode(platformName)}</strong>.</p>
                            <p style='margin:0 0 14px;'>Store Name: <strong>{WebUtility.HtmlEncode(storeName)}</strong></p>
                            <p style='margin:0 0 14px;'>We've received your details and our team will review your application shortly.</p>
                            <p style='margin:0 0 14px;'>You will receive another email once your store is approved or if we need additional information.</p>
                            <p style='margin:0;'>Need help? Contact us at <a href='mailto:{supportEmail}' style='color:#2563eb; text-decoration:none;'>{supportEmail}</a>.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style='border-top:1px solid #e5e7eb; padding:20px; text-align:center; background:#ffffff;'>
                            <p style='margin:0; font-size:13px; font-weight:700; color:#111827;'>{footerBrand}</p>
                            <p style='margin:8px 0 0; font-size:12px; color:#6b7280;'>&copy; {DateTime.UtcNow.Year} {footerCompany} All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
        }

        private static string BuildStoreDecisionEmailBody(
            string platformName,
            string brandColor,
            string supportEmail,
            string footerBrand,
            string footerCompany,
            string ownerName,
            string storeName,
            bool approved,
            string reason)
        {
            var encodedReason = WebUtility.HtmlEncode((reason ?? string.Empty).Trim());
            var decisionHeading = approved ? "Store Application Approved" : "Store Application Update";
            var decisionLine = approved
                ? "Great news. Your store application has been approved and your store is now active."
                : "Your store application was reviewed but could not be approved at this time.";
            var reasonBlock = (!approved && !string.IsNullOrWhiteSpace(encodedReason))
                ? $@"<div style='margin:14px 0; padding:12px; border-radius:6px; background:#fff1f2; border:1px solid #fecdd3; color:#9f1239;'>
                        <strong>Reason:</strong> {encodedReason}
                    </div>"
                : string.Empty;
            var nextStep = approved
                ? "You can now manage your store and start listing your products."
                : "Please review the feedback, update your store details, and resubmit your application.";

            return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin:0; padding:0; background:#f3f4f6; font-family: Arial, Helvetica, sans-serif;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='padding:24px 12px;'>
        <tr>
            <td align='center'>
                <table width='600' cellpadding='0' cellspacing='0' style='max-width:600px; width:100%; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;'>
                    <tr>
                        <td style='background:{brandColor}; padding:24px 20px; text-align:center;'>
                            <h1 style='margin:0; color:{EmailBrandingHelper.GetHeroTextColor(brandColor)}; font-size:32px; font-weight:700;'>{decisionHeading}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding:28px 24px; color:#111827; font-size:15px; line-height:1.55;'>
                            <p style='margin:0 0 14px;'>Dear {WebUtility.HtmlEncode(ownerName)},</p>
                            <p style='margin:0 0 14px;'>{decisionLine}</p>
                            <p style='margin:0 0 14px;'>Store Name: <strong>{WebUtility.HtmlEncode(storeName)}</strong></p>
                            {reasonBlock}
                            <p style='margin:0 0 14px;'>{nextStep}</p>
                            <p style='margin:0;'>For assistance, contact us at <a href='mailto:{supportEmail}' style='color:#2563eb; text-decoration:none;'>{supportEmail}</a>.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style='border-top:1px solid #e5e7eb; padding:20px; text-align:center; background:#ffffff;'>
                            <p style='margin:0; font-size:13px; font-weight:700; color:#111827;'>{footerBrand}</p>
                            <p style='margin:8px 0 0; font-size:12px; color:#6b7280;'>&copy; {DateTime.UtcNow.Year} {footerCompany} All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
        }

        private async Task<string> ProcessKycImage(string imageBase64, string storeName, string side, string timestamp)
        {
            if (string.IsNullOrEmpty(imageBase64) || !IsBase64(imageBase64))
            {
                return imageBase64;
            }

            try
            {
                var fileName = $"StoreKyc_{SanitizeName(storeName)}_{side}_{timestamp}.png";
                var url = await _blobStorageService.UploadImageAsync(imageBase64, fileName);
                return url ?? imageBase64;
            }
            catch (Exception ex)
            {
                Logger.Error($"[BlobStorage] Failed to upload KYC {side} image for store {storeName}", ex);
                return imageBase64;
            }
        }

        private bool IsBase64(string base64String)
        {
            if (string.IsNullOrEmpty(base64String)) return false;
            return base64String.Contains("base64,") || base64String.Length > 1000;
        }

        private string SanitizeName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "Store";
            string sanitized = System.Text.RegularExpressions.Regex.Replace(name, @"[^a-zA-Z0-9_\-]", "");
            return !string.IsNullOrWhiteSpace(sanitized) ? sanitized : "Store";
        }
    }
}
