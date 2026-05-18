using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Entities;
using Abp.Domain.Repositories;
using Abp.Extensions;
using Abp.IdentityFramework;
using Abp.Linq.Extensions;
using Abp.Localization;
using Abp.Runtime.Session;
using Elicom.Authorization;
using Elicom.Authorization.Roles;
using Elicom.Authorization.Users;
using Elicom.Roles.Dto;
using Elicom.Users.Dto;
using Elicom.Wallets;
using Elicom.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Threading.Tasks;

namespace Elicom.Users;

[AbpAuthorize(PermissionNames.Pages_Users)]
public class UserAppService : AsyncCrudAppService<User, UserDto, long, PagedUserResultRequestDto, CreateUserDto, UserDto>, IUserAppService
{
    private readonly UserManager _userManager;
    private readonly RoleManager _roleManager;
    private readonly IRepository<Role> _roleRepository;
    private readonly IWalletManager _walletManager;
    private readonly IRepository<DepositRequest, Guid> _depositRepository;
    private readonly IRepository<WithdrawRequest, long> _withdrawRepository;
    private readonly IRepository<AppTransaction, long> _transactionRepository;

    public UserAppService(
        IRepository<User, long> repository,
        UserManager userManager,
        RoleManager roleManager,
        IRepository<Role> roleRepository,
        IWalletManager walletManager,
        IRepository<DepositRequest, Guid> depositRepository,
        IRepository<WithdrawRequest, long> withdrawRepository,
        IRepository<AppTransaction, long> transactionRepository)
        : base(repository)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _roleRepository = roleRepository;
        _walletManager = walletManager;
        _depositRepository = depositRepository;
        _withdrawRepository = withdrawRepository;
        _transactionRepository = transactionRepository;
    }

    [Abp.Domain.Uow.UnitOfWork(System.Transactions.TransactionScopeOption.Suppress)]
    public override async Task<UserDto> CreateAsync(CreateUserDto input)
    {
        CheckCreatePermission();

        var user = ObjectMapper.Map<User>(input);

        user.TenantId = AbpSession.TenantId;
        user.IsEmailConfirmed = true;

        await _userManager.InitializeOptionsAsync(AbpSession.TenantId);

        CheckErrors(await _userManager.CreateAsync(user, input.Password));

        if (input.RoleNames != null)
        {
            CheckErrors(await _userManager.SetRolesAsync(user, input.RoleNames));
        }

        // CurrentUnitOfWork.SaveChanges(); // Removed for atomicity

        return MapToEntityDto(user);
    }

    public override async Task<UserDto> UpdateAsync(UserDto input)
    {
        CheckUpdatePermission();

        var user = await _userManager.GetUserByIdAsync(input.Id);

        MapToEntity(input, user);

        CheckErrors(await _userManager.UpdateAsync(user));

        if (input.RoleNames != null)
        {
            CheckErrors(await _userManager.SetRolesAsync(user, input.RoleNames));
        }

        return await GetAsync(input);
    }

    public override async Task DeleteAsync(EntityDto<long> input)
    {
        var user = await _userManager.GetUserByIdAsync(input.Id);
        await _userManager.DeleteAsync(user);
    }

    [AbpAuthorize(PermissionNames.Pages_Users_Activation)]
    public async Task Activate(EntityDto<long> user)
    {
        await Repository.UpdateAsync(user.Id, async (entity) =>
        {
            entity.IsActive = true;
        });
    }

    [AbpAuthorize(PermissionNames.Pages_Users_Activation)]
    public async Task DeActivate(EntityDto<long> user)
    {
        await Repository.UpdateAsync(user.Id, async (entity) =>
        {
            entity.IsActive = false;
        });
    }

    public async Task<ListResultDto<RoleDto>> GetRoles()
    {
        var roles = await _roleRepository.GetAllListAsync();
        return new ListResultDto<RoleDto>(ObjectMapper.Map<List<RoleDto>>(roles));
    }

    public async Task ChangeLanguage(ChangeUserLanguageDto input)
    {
        await SettingManager.ChangeSettingForUserAsync(
            AbpSession.ToUserIdentifier(),
            LocalizationSettingNames.DefaultLanguage,
            input.LanguageName
        );
    }

    [HttpGet]
    public async Task<UserStatsDto> GetUserStatsAsync([FromQuery] long userId)
    {
        var stats = new UserStatsDto();

        stats.WalletBalance = await _walletManager.GetBalanceAsync(userId);

        stats.TotalDeposit = await _depositRepository.GetAll()
            .Where(x => x.UserId == userId && x.Status == "Approved")
            .SumAsync(x => x.Amount);

        stats.TotalWithdrawals = await _withdrawRepository.GetAll()
            .Where(x => x.UserId == userId && x.Status == "Approved")
            .SumAsync(x => x.Amount);

        stats.PendingPayout = await _withdrawRepository.GetAll()
            .Where(x => x.UserId == userId && x.Status == "Pending")
            .SumAsync(x => x.Amount);

        stats.TotalCardSpending = Math.Abs(await _transactionRepository.GetAll()
            .Where(x => x.UserId == userId && x.MovementType == "Debit" && (x.Category == "Purchase" || x.Category == "Card Transaction" || x.Category == "Plan Upgrade") && x.CardId != null && x.Status == "Approved")
            .SumAsync(x => x.Amount));

        return stats;
    }

    protected override User MapToEntity(CreateUserDto createInput)
    {
        var user = ObjectMapper.Map<User>(createInput);
        user.SetNormalizedNames();
        return user;
    }

    protected override void MapToEntity(UserDto input, User user)
    {
        ObjectMapper.Map(input, user);
        user.SetNormalizedNames();
    }

    protected override UserDto MapToEntityDto(User user)
    {
        var roleIds = user.Roles.Select(x => x.RoleId).ToArray();

        var roles = _roleManager.Roles.Where(r => roleIds.Contains(r.Id)).Select(r => r.NormalizedName);

        var userDto = base.MapToEntityDto(user);
        userDto.RoleNames = roles.ToArray();

        return userDto;
    }

    protected override IQueryable<User> CreateFilteredQuery(PagedUserResultRequestDto input)
    {
        return Repository.GetAllIncluding(x => x.Roles)
            .WhereIf(!input.Keyword.IsNullOrWhiteSpace(), x => x.UserName.Contains(input.Keyword) || x.Name.Contains(input.Keyword) || x.EmailAddress.Contains(input.Keyword))
            .WhereIf(input.IsActive.HasValue, x => x.IsActive == input.IsActive);
    }

    protected override async Task<User> GetEntityByIdAsync(long id)
    {
        var user = await Repository.GetAllIncluding(x => x.Roles).FirstOrDefaultAsync(x => x.Id == id);

        if (user == null)
        {
            throw new EntityNotFoundException(typeof(User), id);
        }

        return user;
    }

    protected override IQueryable<User> ApplySorting(IQueryable<User> query, PagedUserResultRequestDto input)
    {
        return query.OrderBy(input.Sorting);
    }

    protected virtual void CheckErrors(IdentityResult identityResult)
    {
        identityResult.CheckErrors(LocalizationManager);
    }

}

