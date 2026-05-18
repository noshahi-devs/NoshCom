using Abp.Application.Services;
using Elicom.Subscriptions.Dto;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Elicom.Subscriptions;

public interface ISubscriptionAppService : IApplicationService
{
    Task<List<TenantAdminSubscriptionDto>> GetHostTenantSubscriptions();
    Task<TenantAdminSubscriptionDto> UpdateTenantAdminSubscription(UpdateTenantAdminSubscriptionInput input);
    Task<MySubscriptionOverviewDto> GetMySubscriptionOverview();
    Task<MySubscriptionOverviewDto> GetActiveTenantSubscription();
}
