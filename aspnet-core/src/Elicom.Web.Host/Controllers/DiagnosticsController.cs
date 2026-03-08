using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Azure.Communication.Email;
using Azure;
using Microsoft.Extensions.Configuration;
using Abp.AspNetCore.Mvc.Controllers;
using Elicom.Sessions;
using Elicom.Authorization.Users;
using Elicom.MultiTenancy;
using Abp.Runtime.Session;

namespace Elicom.Web.Host.Controllers
{
    [Route("api/diagnostics")]
    public class DiagnosticsController : AbpController
    {
        private readonly IConfiguration _configuration;
        private readonly ISessionAppService _sessionAppService;
        private readonly UserManager _userManager;
        private readonly TenantManager _tenantManager;

        public DiagnosticsController(
            IConfiguration configuration,
            ISessionAppService sessionAppService,
            UserManager userManager,
            TenantManager tenantManager)
        {
            _configuration = configuration;
            _sessionAppService = sessionAppService;
            _userManager = userManager;
            _tenantManager = tenantManager;
        }

        [HttpGet("email")]
        public async Task<IActionResult> TestEmail(string to)
        {
            try
            {
                var connectionString = _configuration["Settings:Abp.Net.Mail.Smtp.Password"]?.StartsWith("endpoint=") == true 
                    ? _configuration["Settings:Abp.Net.Mail.Smtp.Password"] 
                    : $"endpoint=https://comm-elicom-prod.unitedstates.communication.azure.com/;accesskey={_configuration["Settings:Abp.Net.Mail.Smtp.Password"]}";
                
                var sender = _configuration["Settings:Abp.Net.Mail.DefaultFromAddress"] ?? "DoNotReply@easyfinora.com";

                var emailClient = new EmailClient(connectionString);
                
                var emailMessage = new EmailMessage(
                    senderAddress: sender,
                    recipientAddress: to ?? "noshahidevelopersinc@gmail.com",
                    content: new EmailContent("Diagnostics Test Email")
                    {
                        Html = "<h1>This is a test from DiagnosticsController</h1>"
                    }
                );

                var operation = await emailClient.SendAsync(WaitUntil.Completed, emailMessage);
                return Ok(new 
                { 
                    Success = true, 
                    Verification = "Email Sent via Azure SDK", 
                    OperationId = operation.Id,
                    Status = operation.GetRawResponse().Status.ToString()
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new 
                { 
                    Success = false, 
                    Error = ex.Message, 
                    Stack = ex.StackTrace,
                    Inner = ex.InnerException?.Message 
                });
            }
        }

        [HttpGet("session")]
        public async Task<IActionResult> TestSession()
        {
            try
            {
                var info = await _sessionAppService.GetCurrentLoginInformations();
                return Ok(info);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new 
                { 
                    Success = false, 
                    Error = ex.Message, 
                    Stack = ex.StackTrace,
                    Inner = ex.InnerException?.Message 
                });
            }
        }
        
        [HttpGet("env")]
        public IActionResult GetEnv()
        {
            return Ok(new
            {
                SmtpUser = _configuration["Settings:Abp.Net.Mail.Smtp.UserName"],
                SmtpHost = _configuration["Settings:Abp.Net.Mail.Smtp.Host"],
                DefaultFrom = _configuration["Settings:Abp.Net.Mail.DefaultFromAddress"],
                AbpSessionUserId = AbpSession.UserId,
                AbpSessionTenantId = AbpSession.TenantId
            });
        }
    }
}
