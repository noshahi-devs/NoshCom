using Abp.Application.Services;
using Elicom.Authorization.Accounts.Dto;
using System.Threading.Tasks;

namespace Elicom.Authorization.Accounts;

public interface IAccountAppService : IApplicationService
{
    Task<IsTenantAvailableOutput> IsTenantAvailable(IsTenantAvailableInput input);

    Task<RegisterOutput> Register(RegisterInput input);

    Task RegisterSeller(string email);

    Task<Microsoft.AspNetCore.Mvc.ContentResult> VerifyEmail(long userId, string token, string platform = "Prime Ship");

    Task ForgotPassword(string email);

    Task ResetPassword(ResetPasswordInput input);

    Task RegisterSmartStoreSeller(RegisterSmartStoreInput input);
    Task RegisterSmartStoreCustomer(RegisterSmartStoreInput input);

    Task RegisterPrimeShipSeller(RegisterPrimeShipInput input);
    Task RegisterPrimeShipCustomer(RegisterPrimeShipInput input);

    Task RegisterGlobalPayUser(RegisterGlobalPayInput input);

    Task SendSampleEmail();
}
