using Abp.Authorization.Users;
using Abp.Application.Services.Dto;
using Abp.Net.Mail;
using Abp.Domain.Uow;
using Elicom.Authorization.Users;
using Elicom.Transactions;
using Elicom.Transactions.Dto;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using System;

namespace Elicom.Test
{
    public class TestAppService : ElicomAppServiceBase
    {
        private readonly IEmailSender _emailSender;
        private readonly UserManager _userManager;
        private readonly ITransactionAppService _transactionAppService;

        public TestAppService(
            IEmailSender emailSender,
            UserManager userManager,
            ITransactionAppService transactionAppService)
        {
            _emailSender = emailSender;
            _userManager = userManager;
            _transactionAppService = transactionAppService;
        }

        // Intentionally non-public: test/debug operation should not be exposed as a remote API endpoint.
        private async Task ForceActivateUser(string email)
        {
            using (CurrentUnitOfWork.SetTenantId(1)) 
            {
                var user = _userManager.Users.FirstOrDefault(u => u.EmailAddress == email);
                if (user != null)
                {
                    user.IsActive = true;
                    user.IsEmailConfirmed = true;
                    await _userManager.UpdateAsync(user);
                    Logger.Info($"USER ACTIVATED: {email}");
                }
                else
                {
                    Logger.Warn($"USER NOT FOUND: {email}");
                }
            }
        }

        // Intentionally non-public: test/debug operation should not be exposed as a remote API endpoint.
        private async Task SendPlacementTest()
        {
            var orderRef = "TEST-PLACE-" + DateTime.UtcNow.ToString("yyyyMMddHHss");
            var mail = new System.Net.Mail.MailMessage("no-reply@primeshipuk.com", "noshahidevelopersinc@gmail.com")
            {
                Subject = $"New Wholesale Order: {orderRef}",
                Body = $"[TEST] A new wholesale order has been placed.\nTotal: 250.00\nCustomer: Test Jenkins",
                IsBodyHtml = false
            };
            // DISABLED per request: non-production SMTP test email
            // await _emailSender.SendAsync(mail);
        }

        // Intentionally non-public: test/debug operation should not be exposed as a remote API endpoint.
        private async Task SendShippingTest()
        {
            var orderRef = "TEST-SHIP-" + DateTime.UtcNow.ToString("yyyyMMddHHss");
            var mail = new System.Net.Mail.MailMessage("no-reply@primeshipuk.com", "noshahidevelopersinc@gmail.com")
            {
                Subject = $"[PrimeShip] Order Shipped: {orderRef}",
                Body = $"[TEST] Wholesale order {orderRef} has been marked as SHIPPED.\nTracking: TRK123456",
                IsBodyHtml = false
            };
            // DISABLED per request: non-production SMTP test email
            // await _emailSender.SendAsync(mail);
        }

        // Intentionally non-public: test/debug operation should not be exposed as a remote API endpoint.
        private async Task SendDeliveryTest()
        {
            var orderRef = "TEST-DELIVER-" + DateTime.UtcNow.ToString("yyyyMMddHHss");
            var mail = new System.Net.Mail.MailMessage("no-reply@primeshipuk.com", "noshahidevelopersinc@gmail.com")
            {
                Subject = $"[PrimeShip] Order Delivered: {orderRef}",
                Body = $"[TEST] Wholesale order {orderRef} has been marked as DELIVERED.",
                IsBodyHtml = false
            };
            // DISABLED per request: non-production SMTP test email
            // await _emailSender.SendAsync(mail);
        }

        // Intentionally non-public: test/debug operation should not be exposed as a remote API endpoint.
        private async Task DeletePlatformUsers(string email)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var prefixes = new[] { "SS_", "PS_", "GP_" };
                foreach (var prefix in prefixes)
                {
                    var userName = $"{prefix}{email}";
                    var user = await _userManager.FindByNameAsync(userName);
                    if (user != null)
                    {
                        await _userManager.DeleteAsync(user);
                        Logger.Info($"USER DELETED: {userName}");
                    }
                }
            }
        }

        // Intentionally non-public: keep alias logic in codebase, but do not expose /Test routes publicly.
        private Task<PagedResultDto<TransactionDto>> GetHistory(PagedAndSortedResultRequestDto input)
        {
            // Backward-compatible alias for clients still calling /Test/GetHistory.
            return _transactionAppService.GetHistory(input);
        }
    }
}
