using Abp.Application.Services;
using Elicom.Sessions.Dto;
using System.Threading.Tasks;

namespace Elicom.Sessions;

public interface ISessionAppService : IApplicationService
{
    Task<GetCurrentLoginInformationsOutput> GetCurrentLoginInformations();
}
