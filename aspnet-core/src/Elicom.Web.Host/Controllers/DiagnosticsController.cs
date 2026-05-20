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
using Abp.Net.Mail;

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
        private readonly IEmailSender _emailSender;

        public DiagnosticsController(
            IConfiguration configuration,
            ISessionAppService sessionAppService,
            UserManager userManager,
            TenantManager tenantManager,
            IEmailSender emailSender)
        {
            _configuration = configuration;
            _sessionAppService = sessionAppService;
            _userManager = userManager;
            _tenantManager = tenantManager;
            _emailSender = emailSender;
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

                var smtpHost = _configuration[$"EmailSettings:{platformKey}:SmtpHost"] ?? "premium342.web-hosting.com";
                var portStr = _configuration[$"EmailSettings:{platformKey}:Port"] ?? "587";
                var userStr = _configuration[$"EmailSettings:{platformKey}:Username"] ?? "support@thesmartshop.uk";
                var passStr = _configuration[$"EmailSettings:{platformKey}:Password"] ?? "N0$h@hidot000";
                var enableSsl = true;

                int.TryParse(portStr, out var smtpPort);
                if (smtpPort <= 0) smtpPort = 587;

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

        [HttpGet]
        [Route("DebugEmail")]
        public async Task<IActionResult> DebugEmail(
            [FromQuery] string to = "noshahidevelopersinc@gmail.com",
            [FromQuery] string platform = "World Cart",
            [FromQuery] string overrideFromEmail = "support@thesmartshop.uk",
            [FromQuery] string overrideUsername = null,
            [FromQuery] string overridePassword = null,
            [FromQuery] string overrideHost = null,
            [FromQuery] int? overridePort = null,
            [FromQuery] bool? overrideEnableSsl = null)
        {
            var logs = new System.Collections.Generic.List<string>();
            
            Action<string> log = (msg) => 
            {
                var formatted = $"[EMAIL_DEBUG] {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC - {msg}";
                Console.WriteLine(formatted);
                logs.Add(formatted);
            };

            Func<string, string> mask = (val) => 
            {
                if (string.IsNullOrEmpty(val)) return "<null/empty>";
                if (val.Length <= 4) return "****";
                return $"{val.Substring(0, 2)}...{val.Substring(val.Length - 2)} (Length: {val.Length})";
            };

            log("=== STARTING DEEP SMTP/EMAIL DEBUGGING ===");
            log($"Parameters: to={to}, platform={platform}, overrideFromEmail={overrideFromEmail}");

            // 1. CONFIGURATION SCANNING
            log("--- STEP 1: Scanning Configuration Keys ---");
            try
            {
                foreach (var pair in _configuration.AsEnumerable())
                {
                    var key = pair.Key;
                    var val = pair.Value;
                    if (string.IsNullOrEmpty(val)) continue;

                    var lowerKey = key.ToLowerInvariant();
                    if (lowerKey.Contains("smtp") || lowerKey.Contains("mail") || lowerKey.Contains("email") || lowerKey.Contains("brevo"))
                    {
                        var isPass = lowerKey.Contains("pass") || lowerKey.Contains("key") || lowerKey.Contains("secret");
                        log($"Config Key: {key} = {(isPass ? mask(val) : val)}");
                    }
                }
            }
            catch (Exception ex)
            {
                log($"Error scanning configuration keys: {ex.Message}");
            }

            // 2. ENVIRONMENT VARIABLES SCANNING
            log("--- STEP 2: Scanning Environment Variables ---");
            try
            {
                var envVars = System.Environment.GetEnvironmentVariables();
                foreach (System.Collections.DictionaryEntry entry in envVars)
                {
                    var key = entry.Key?.ToString();
                    var val = entry.Value?.ToString();
                    if (string.IsNullOrEmpty(key) || string.IsNullOrEmpty(val)) continue;

                    var lowerKey = key.ToLowerInvariant();
                    if (lowerKey.Contains("smtp") || lowerKey.Contains("mail") || lowerKey.Contains("email") || lowerKey.Contains("brevo"))
                    {
                        var isPass = lowerKey.Contains("pass") || lowerKey.Contains("key") || lowerKey.Contains("secret");
                        log($"Env Var: {key} = {(isPass ? mask(val) : val)}");
                    }
                }
            }
            catch (Exception ex)
            {
                log($"Error scanning environment variables: {ex.Message}");
            }

            // 3. SMTP CONFIGURATION RESOLUTION
            log("--- STEP 3: Executing SMTP Resolution Logic ---");
            
            var sectionPrefix = GetEmailSectionPrefix(platform);
            log($"Resolved Section Prefix for platform '{platform}': '{sectionPrefix}'");

            var sectionHost = _configuration[$"{sectionPrefix}:SmtpHost"];
            var sectionPort = _configuration[$"{sectionPrefix}:Port"];
            var sectionEnableSsl = _configuration[$"{sectionPrefix}:EnableSsl"];
            var sectionUser = _configuration[$"{sectionPrefix}:Username"];
            var sectionPass = _configuration[$"{sectionPrefix}:Password"];
            log($"Section Config: Host={sectionHost}, Port={sectionPort}, EnableSsl={sectionEnableSsl}, User={sectionUser}, Pass={mask(sectionPass)}");

            var emailSettingsHost = _configuration["EmailSettings:SmtpHost"];
            var emailSettingsPort = _configuration["EmailSettings:Port"];
            var emailSettingsEnableSsl = _configuration["EmailSettings:EnableSsl"];
            var emailSettingsUser = FirstNonEmpty(
                _configuration["EmailSettings:Username"],
                _configuration["BREVO_SMTP_USERNAME"]);
            var emailSettingsPass = FirstNonEmpty(
                _configuration["EmailSettings:Password"],
                _configuration["BREVO_SMTP_PASSWORD"]);
            log($"EmailSettings: Host={emailSettingsHost}, Port={emailSettingsPort}, EnableSsl={emailSettingsEnableSsl}, User={emailSettingsUser}, Pass={mask(emailSettingsPass)}");

            var abpHost = FirstNonEmpty(
                _configuration["Settings:Abp.Net.Mail.Smtp.Host"],
                _configuration["Abp.Net.Mail.Smtp.Host"]);
            var abpPort = FirstNonEmpty(
                _configuration["Settings:Abp.Net.Mail.Smtp.Port"],
                _configuration["Abp.Net.Mail.Smtp.Port"]);
            var abpEnableSsl = FirstNonEmpty(
                _configuration["Settings:Abp.Net.Mail.Smtp.EnableSsl"],
                _configuration["Abp.Net.Mail.Smtp.EnableSsl"]);
            var abpUser = FirstNonEmpty(
                _configuration["Settings:Abp.Net.Mail.Smtp.UserName"],
                _configuration["Abp.Net.Mail.Smtp.UserName"]);
            var abpPass = FirstNonEmpty(
                _configuration["Settings:Abp.Net.Mail.Smtp.Password"],
                _configuration["Abp.Net.Mail.Smtp.Password"]);
            log($"AbpSettings: Host={abpHost}, Port={abpPort}, EnableSsl={abpEnableSsl}, User={abpUser}, Pass={mask(abpPass)}");

            var credentialsSource = "fallback";
            var resolvedUser = (string)null;
            var resolvedPass = (string)null;

            if (!HasValuePair(resolvedUser, resolvedPass))
            {
                if (HasValuePair(sectionUser, sectionPass))
                {
                    credentialsSource = "section";
                    resolvedUser = sectionUser;
                    resolvedPass = sectionPass;
                }
                else if (HasValuePair(emailSettingsUser, emailSettingsPass))
                {
                    credentialsSource = "email-settings";
                    resolvedUser = emailSettingsUser;
                    resolvedPass = emailSettingsPass;
                }
                else if (HasValuePair(abpUser, abpPass))
                {
                    credentialsSource = "abp-settings";
                    resolvedUser = abpUser;
                    resolvedPass = abpPass;
                }
            }
            else
            {
                credentialsSource = "method";
            }
            log($"Selected Credentials Source: '{credentialsSource}'");

            if (string.IsNullOrWhiteSpace(resolvedUser))
            {
                resolvedUser = FirstNonEmpty(sectionUser, emailSettingsUser, abpUser);
                log($"Fallback resolvedUser picked from FirstNonEmpty: {resolvedUser}");
            }

            if (string.IsNullOrWhiteSpace(resolvedPass))
            {
                resolvedPass = FirstNonEmpty(sectionPass, emailSettingsPass, abpPass);
                log($"Fallback resolvedPass picked from FirstNonEmpty: {mask(resolvedPass)}");
            }
            log($"DEBUG: Exact resolvedPass string is '{resolvedPass}' (Length: {resolvedPass?.Length})");

            string resolvedHost;
            switch (credentialsSource)
            {
                case "section":
                    resolvedHost = FirstNonEmpty(sectionHost, emailSettingsHost, abpHost, "smtp-relay.brevo.com");
                    break;
                case "email-settings":
                    resolvedHost = FirstNonEmpty(emailSettingsHost, abpHost, sectionHost, "smtp-relay.brevo.com");
                    break;
                case "abp-settings":
                    resolvedHost = FirstNonEmpty(abpHost, emailSettingsHost, sectionHost, "smtp-relay.brevo.com");
                    break;
                default:
                    resolvedHost = FirstNonEmpty(sectionHost, emailSettingsHost, abpHost, "smtp-relay.brevo.com");
                    break;
            }
            log($"Resolved Host: '{resolvedHost}'");

            string configuredPort;
            switch (credentialsSource)
            {
                case "section":
                    configuredPort = FirstNonEmpty(sectionPort, emailSettingsPort, abpPort);
                    break;
                case "email-settings":
                    configuredPort = FirstNonEmpty(emailSettingsPort, abpPort, sectionPort);
                    break;
                case "abp-settings":
                    configuredPort = FirstNonEmpty(abpPort, emailSettingsPort, sectionPort);
                    break;
                default:
                    configuredPort = FirstNonEmpty(sectionPort, emailSettingsPort, abpPort);
                    break;
            }
            log($"Resolved Configured Port String: '{configuredPort}'");

            var port = 0;
            if (int.TryParse(configuredPort, out var parsedPort) && parsedPort > 0)
            {
                port = parsedPort;
            }
            if (port <= 0)
            {
                port = 587;
                log("Resolved Port fell back to default: 587");
            }
            else
            {
                log($"Parsed resolved Port: {port}");
            }

            var senderEmail = overrideFromEmail;
            if (string.IsNullOrWhiteSpace(senderEmail))
            {
                senderEmail = _configuration[$"{sectionPrefix}:FromAddress"];
                log($"Sender email resolved from prefix: {senderEmail}");
            }
            if (string.IsNullOrWhiteSpace(senderEmail))
            {
                senderEmail = GetSenderEmailForPlatform(platform);
                log($"Sender email resolved from platform helper: {senderEmail}");
            }
            if (string.IsNullOrWhiteSpace(senderEmail))
            {
                senderEmail = _configuration["Settings:Abp.Net.Mail.DefaultFromAddress"];
                log($"Sender email resolved from default config: {senderEmail}");
            }
            if (string.IsNullOrWhiteSpace(senderEmail))
            {
                senderEmail = "no-reply@worldcartus.com";
                log($"Sender email resolved to fallback default: {senderEmail}");
            }

            string enableSslRaw;
            switch (credentialsSource)
            {
                case "section":
                    enableSslRaw = FirstNonEmpty(sectionEnableSsl, emailSettingsEnableSsl, abpEnableSsl, "true");
                    break;
                case "email-settings":
                    enableSslRaw = FirstNonEmpty(emailSettingsEnableSsl, abpEnableSsl, sectionEnableSsl, "true");
                    break;
                case "abp-settings":
                    enableSslRaw = FirstNonEmpty(abpEnableSsl, emailSettingsEnableSsl, sectionEnableSsl, "true");
                    break;
                default:
                    enableSslRaw = FirstNonEmpty(sectionEnableSsl, emailSettingsEnableSsl, abpEnableSsl, "true");
                    break;
            }
            var enableSsl = !string.Equals(enableSslRaw, "false", StringComparison.OrdinalIgnoreCase);
            log($"Resolved EnableSSL: {enableSsl} (raw: '{enableSslRaw}')");

            if (!string.IsNullOrWhiteSpace(overrideHost))
            {
                resolvedHost = overrideHost;
                log($"[OVERRIDE] SMTP Host overridden to: '{resolvedHost}'");
            }
            if (overridePort.HasValue && overridePort.Value > 0)
            {
                port = overridePort.Value;
                log($"[OVERRIDE] SMTP Port overridden to: {port}");
            }
            if (!string.IsNullOrWhiteSpace(overrideUsername))
            {
                resolvedUser = overrideUsername;
                log($"[OVERRIDE] SMTP Username overridden to: '{resolvedUser}'");
            }
            if (!string.IsNullOrWhiteSpace(overridePassword))
            {
                resolvedPass = overridePassword;
                log($"[OVERRIDE] SMTP Password overridden to: '{mask(resolvedPass)}'");
            }
            if (overrideEnableSsl.HasValue)
            {
                enableSsl = overrideEnableSsl.Value;
                log($"[OVERRIDE] SMTP EnableSsl overridden to: {enableSsl}");
            }

            var isConfigValid = true;
            if (string.IsNullOrWhiteSpace(resolvedHost))
            {
                log("ERROR: SMTP host is not configured.");
                isConfigValid = false;
            }
            if (string.IsNullOrWhiteSpace(resolvedUser) || string.IsNullOrWhiteSpace(resolvedPass))
            {
                log("ERROR: SMTP username or password is not configured.");
                isConfigValid = false;
            }

            var primarySuccess = false;
            var fallbackSuccess = false;
            var primaryExceptionMsg = "";
            var fallbackExceptionMsg = "";

            // 4. PRIMARY MAILKIT ATTEMPT
            if (isConfigValid)
            {
                log("--- STEP 4: Attempting Primary MailKit + MimeKit Flow ---");
                try
                {
                    var message = new MimeMessage();
                    message.From.Add(new MailboxAddress(platform, senderEmail));
                    message.To.Add(MailboxAddress.Parse(to));
                    message.Subject = $"Elicom SMTP Debug Test Email - {platform}";
                    message.Body = new TextPart("html") 
                    { 
                        Text = $"<h3>Deep SMTP debugging test email for platform '{platform}'!</h3><p>Sent at: {DateTime.UtcNow:O} UTC</p><p>Host: {resolvedHost}:{port} (TLS={enableSsl})</p><p>Resolved Credentials Source: {credentialsSource}</p>" 
                    };

                    log("Created MimeMessage successfully.");
                    log($"From: {senderEmail}, To: {to}");

                    using (var smtp = new SmtpClient())
                    {
                        log("Created SmtpClient instance.");
                        
                        smtp.ServerCertificateValidationCallback = (smtpSender, certificate, chain, errors) => 
                        {
                            log($"Server SSL Certificate validation callback invoked. Errors: {errors}");
                            return true; 
                        };

                        var secureMode = enableSsl
                             ? (port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls)
                             : SecureSocketOptions.None;
                        log($"Resolved SecureSocketOptions mode: {secureMode}");

                        log($"Attempting ConnectAsync to {resolvedHost}:{port}...");
                        try
                        {
                            await smtp.ConnectAsync(resolvedHost, port, secureMode);
                            log("ConnectAsync succeeded.");
                        }
                        catch (Exception ex) when (port == 465)
                        {
                            log($"ConnectAsync failed on port 465: {ex.Message}. Attempting fallback port 587 with STARTTLS...");
                            await smtp.ConnectAsync(resolvedHost, 587, SecureSocketOptions.StartTls);
                            log("ConnectAsync fallback succeeded on port 587.");
                        }

                        log($"Attempting AuthenticateAsync with user '{resolvedUser}'...");
                        await smtp.AuthenticateAsync(resolvedUser, resolvedPass ?? string.Empty);
                        log("AuthenticateAsync succeeded.");

                        log("Attempting SendAsync...");
                        await smtp.SendAsync(message);
                        log("SendAsync succeeded.");

                        log("Attempting DisconnectAsync...");
                        await smtp.DisconnectAsync(true);
                        log("DisconnectAsync succeeded.");
                        
                        log("SUCCESS: MailKit SMTP email sent successfully!");
                        primarySuccess = true;
                    }
                }
                catch (Exception ex)
                {
                    primaryExceptionMsg = BuildExceptionChain(ex);
                    log($"ERROR in Primary MailKit Send: {primaryExceptionMsg}");
                }
            }

            // 5. FALLBACK ABP SYSTEM.NET.MAIL ATTEMPT
            if (!primarySuccess)
            {
                log("--- STEP 5: Primary Path Failed. Triggering Fallback System.Net.Mail Send ---");
                try
                {
                    var mail = new System.Net.Mail.MailMessage
                    {
                        Subject = $"Elicom SMTP Fallback Debug Test Email - {platform}",
                        Body = $"<h3>Deep SMTP debugging fallback test email for platform '{platform}'!</h3><p>Sent at: {DateTime.UtcNow:O} UTC</p>",
                        IsBodyHtml = true
                    };
                    mail.To.Add(to);
                    mail.From = new System.Net.Mail.MailAddress(senderEmail, platform);

                    log("Created System.Net.Mail.MailMessage successfully.");
                    log($"Attempting fallback send via injected IEmailSender...");
                    await _emailSender.SendAsync(mail);
                    log("SUCCESS: Fallback email sent successfully via IEmailSender!");
                    fallbackSuccess = true;
                }
                catch (Exception ex)
                {
                    fallbackExceptionMsg = BuildExceptionChain(ex);
                    log($"ERROR in Fallback Send: {fallbackExceptionMsg}");
                }
            }

            log("=== COMPLETED SMTP/EMAIL DEBUGGING ATTEMPT ===");

            return Ok(new
            {
                Success = primarySuccess || fallbackSuccess,
                PrimarySuccess = primarySuccess,
                FallbackSuccess = fallbackSuccess,
                Platform = platform,
                ResolvedHost = resolvedHost,
                ResolvedPort = port,
                ResolvedUser = resolvedUser,
                SenderEmail = senderEmail,
                CredentialsSource = credentialsSource,
                EnableSsl = enableSsl,
                PrimaryError = primaryExceptionMsg,
                FallbackError = fallbackExceptionMsg,
                TraceLogs = logs
            });
        }

        private static string GetEmailSectionPrefix(string platformName)
        {
            if (string.IsNullOrWhiteSpace(platformName))
            {
                return "EmailSettings:WorldCart";
            }
            if (platformName.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase) || 
                platformName.Contains("EasyFinora", StringComparison.OrdinalIgnoreCase))
            {
                return "EmailSettings:EasyFinora";
            }
            if (platformName.Contains("Prime Ship", StringComparison.OrdinalIgnoreCase) ||
                platformName.Contains("Primeship", StringComparison.OrdinalIgnoreCase))
            {
                return "EmailSettings:PrimeShip";
            }
            return "EmailSettings:WorldCart";
        }

        private static string GetSenderEmailForPlatform(string platformName)
        {
            if (string.IsNullOrWhiteSpace(platformName))
            {
                return "info@worldcartus.com";
            }
            if (platformName.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase) || 
                platformName.Contains("EasyFinora", StringComparison.OrdinalIgnoreCase))
            {
                return "info@easyfinora.com";
            }
            if (platformName.Contains("Prime Ship", StringComparison.OrdinalIgnoreCase) ||
                platformName.Contains("Primeship", StringComparison.OrdinalIgnoreCase))
            {
                return "info@primeshipuk.com";
            }
            return "info@worldcartus.com";
        }

        private static string FirstNonEmpty(params string[] values)
        {
            foreach (var value in values)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }
            return null;
        }

        private static bool HasValuePair(string first, string second)
        {
            return !string.IsNullOrWhiteSpace(first) && !string.IsNullOrWhiteSpace(second);
        }

        private static string BuildExceptionChain(Exception ex)
        {
            if (ex == null)
            {
                return "Unknown error";
            }
            var sb = new System.Text.StringBuilder();
            var current = ex;
            var depth = 0;
            while (current != null && depth < 6)
            {
                if (depth > 0)
                {
                    sb.Append(" | INNER -> ");
                }
                sb.Append(current.GetType().Name);
                sb.Append(": ");
                sb.Append(current.Message);
                current = current.InnerException;
                depth++;
            }
            var details = sb.ToString();
            return details.Length <= 1200 ? details : details.Substring(0, 1200);
        }
    }
}

