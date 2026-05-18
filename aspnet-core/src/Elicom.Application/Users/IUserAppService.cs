using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Roles.Dto;
using Elicom.Users.Dto;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace Elicom.Users;

public interface IUserAppService : IAsyncCrudAppService<UserDto, long, PagedUserResultRequestDto, CreateUserDto, UserDto>
{
    Task DeActivate(EntityDto<long> user);
    Task Activate(EntityDto<long> user);
    Task<ListResultDto<RoleDto>> GetRoles();
    Task ChangeLanguage(ChangeUserLanguageDto input);
    [HttpGet]
    Task<UserStatsDto> GetUserStatsAsync([FromQuery] long userId);
}
