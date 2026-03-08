using Abp.Application.Services;
using System.Threading.Tasks;
using Elicom.GlobalPay.Dto;

namespace Elicom.GlobalPay
{
    public interface IGlobalPayAdminDashboardAppService : IApplicationService
    {
        Task<GlobalPayAdminDashboardStatsDto> GetStats();
    }
}
