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
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Elicom.Web.Host.Controllers
{
    [ApiExplorerSettings(IgnoreApi = true)]
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

        [HttpGet]
        [Route("TestSmtp")]
        public async Task<IActionResult> TestSmtp(string to, string platform = "World Cart")
        {
            try
            {
                var platformKey = "WorldCart";
                if (platform.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase)) platformKey = "EasyFinora";
                if (platform.Contains("Prime Ship", StringComparison.OrdinalIgnoreCase)) platformKey = "PrimeShip";

                var smtpHost = _configuration[$"EmailSettings:{platformKey}:SmtpHost"] ?? "mail.thesmartshop.uk";
                var portStr = _configuration[$"EmailSettings:{platformKey}:Port"] ?? "465";
                var userStr = _configuration[$"EmailSettings:{platformKey}:Username"] ?? "support@thesmartshop.uk";
                var passStr = _configuration[$"EmailSettings:{platformKey}:Password"] ?? "N0$h@hidot000";
                var enableSsl = true;

                int.TryParse(portStr, out var smtpPort);
                if (smtpPort <= 0) smtpPort = 465;

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(platform, userStr));
                message.To.Add(MailboxAddress.Parse(to ?? "noshahidevelopersinc@gmail.com"));
                message.Subject = $"Diagnostics SMTP Test - {platform}";
                message.Body = new TextPart("html") { Text = $"<h3>This is a diagnostics SMTP test for {platform}!</h3>" };

                using (var smtp = new SmtpClient())
                {
                    smtp.ServerCertificateValidationCallback = (smtpSender, certificate, chain, errors) => true;

                    var secureMode = enableSsl
                        ? (smtpPort == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls)
                        : SecureSocketOptions.None;

                    try
                    {
                        await smtp.ConnectAsync(smtpHost, smtpPort, secureMode);
                    }
                    catch (Exception ex) when (smtpPort == 465)
                    {
                        try
                        {
                            await smtp.ConnectAsync(smtpHost, 587, SecureSocketOptions.StartTls);
                        }
                        catch (Exception fallbackEx)
                        {
                            throw new AggregateException($"Port 465 failed: {ex.Message}. Port 587 fallback failed: {fallbackEx.Message}", fallbackEx);
                        }
                    }
                    if (!string.IsNullOrWhiteSpace(userStr))
                    {
                        await smtp.AuthenticateAsync(userStr, passStr);
                    }
                    await smtp.SendAsync(message);
                    await smtp.DisconnectAsync(true);
                }

                return Ok(new 
                { 
                    Success = true, 
                    Host = smtpHost, 
                    Port = smtpPort, 
                    User = userStr,
                    Message = "Email sent successfully via SMTP!"
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

        [NonAction]
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

        [NonAction]
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
        
        [NonAction]
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
