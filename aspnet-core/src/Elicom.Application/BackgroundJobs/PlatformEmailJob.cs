using Abp.BackgroundJobs;
using Abp.Configuration;
using Abp.Dependency;
using Abp.Net.Mail;
using Elicom.BackgroundJobs;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using System;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.BackgroundJobs
{
    public class PlatformEmailJob : AsyncBackgroundJob<PlatformEmailJobArgs>, ITransientDependency
    {
        private readonly IConfiguration _configuration;
        private readonly ISettingManager _settingManager;

        public PlatformEmailJob(
            IConfiguration configuration,
            ISettingManager settingManager)
        {
            _configuration = configuration;
            _settingManager = settingManager;
        }

        public override async Task ExecuteAsync(PlatformEmailJobArgs args)
        {
            if (args == null ||
                string.IsNullOrWhiteSpace(args.To) ||
                string.IsNullOrWhiteSpace(args.Subject) ||
                string.IsNullOrWhiteSpace(args.HtmlBody))
            {
                Logger.Warn("[PlatformEmailJob] Skipped due to invalid args.");
                return;
            }

            var sectionPrefix = GetEmailSectionPrefix(args.PlatformName);
            var sectionHost = _configuration[$"{sectionPrefix}:SmtpHost"];
            var sectionPort = _configuration[$"{sectionPrefix}:Port"];
            var sectionEnableSsl = _configuration[$"{sectionPrefix}:EnableSsl"];
            var sectionUser = _configuration[$"{sectionPrefix}:Username"];
            var sectionPass = _configuration[$"{sectionPrefix}:Password"];
            var emailSettingsHost = _configuration["EmailSettings:SmtpHost"];
            var emailSettingsPort = _configuration["EmailSettings:Port"];
            var emailSettingsEnableSsl = _configuration["EmailSettings:EnableSsl"];
            var emailSettingsUser = FirstNonEmpty(
                _configuration["EmailSettings:Username"],
                _configuration["BREVO_SMTP_USERNAME"]);
            var emailSettingsPass = FirstNonEmpty(
                _configuration["EmailSettings:Password"],
                _configuration["BREVO_SMTP_PASSWORD"]);

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

            var credentialsSource = "fallback";
            string resolvedUser;
            string resolvedPass;
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
            else
            {
                resolvedUser = FirstNonEmpty(sectionUser, emailSettingsUser, abpUser);
                resolvedPass = FirstNonEmpty(sectionPass, emailSettingsPass, abpPass);
            }

            var resolvedHost = credentialsSource switch
            {
                "section" => FirstNonEmpty(sectionHost, emailSettingsHost, abpHost, "smtp-relay.brevo.com"),
                "email-settings" => FirstNonEmpty(emailSettingsHost, abpHost, sectionHost, "smtp-relay.brevo.com"),
                "abp-settings" => FirstNonEmpty(abpHost, emailSettingsHost, sectionHost, "smtp-relay.brevo.com"),
                _ => FirstNonEmpty(sectionHost, emailSettingsHost, abpHost, "smtp-relay.brevo.com")
            };

            var portText = credentialsSource switch
            {
                "section" => FirstNonEmpty(sectionPort, emailSettingsPort, abpPort),
                "email-settings" => FirstNonEmpty(emailSettingsPort, abpPort, sectionPort),
                "abp-settings" => FirstNonEmpty(abpPort, emailSettingsPort, sectionPort),
                _ => FirstNonEmpty(sectionPort, emailSettingsPort, abpPort)
            };

            var port = 587;
            if (int.TryParse(portText, out var parsedPort) && parsedPort > 0)
            {
                port = parsedPort;
            }

            var enableSslText = credentialsSource switch
            {
                "section" => FirstNonEmpty(sectionEnableSsl, emailSettingsEnableSsl, abpEnableSsl),
                "email-settings" => FirstNonEmpty(emailSettingsEnableSsl, abpEnableSsl, sectionEnableSsl),
                "abp-settings" => FirstNonEmpty(abpEnableSsl, emailSettingsEnableSsl, sectionEnableSsl),
                _ => FirstNonEmpty(sectionEnableSsl, emailSettingsEnableSsl, abpEnableSsl)
            };
            var enableSsl = !string.IsNullOrWhiteSpace(enableSslText)
                ? string.Equals(enableSslText, "true", StringComparison.OrdinalIgnoreCase)
                : (port == 587 || port == 465);

            var senderEmail = FirstNonEmpty(
                _configuration[$"{sectionPrefix}:FromAddress"],
                GetSenderEmailForPlatform(args.PlatformName),
                await _settingManager.GetSettingValueAsync(EmailSettingNames.DefaultFromAddress),
                "info@worldcartus.com");

            var senderName = string.IsNullOrWhiteSpace(args.PlatformName) ? "World Cart" : args.PlatformName;

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(senderName, senderEmail));
                message.To.Add(MailboxAddress.Parse(args.To));
                message.Subject = args.Subject;
                message.Body = new TextPart("html") { Text = args.HtmlBody };

                using var smtp = new SmtpClient();
                var secureMode = enableSsl
                    ? (port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls)
                    : SecureSocketOptions.None;

                await smtp.ConnectAsync(resolvedHost, port, secureMode);

                if (!string.IsNullOrWhiteSpace(resolvedUser))
                {
                    await smtp.AuthenticateAsync(resolvedUser, resolvedPass ?? string.Empty);
                }

                await smtp.SendAsync(message);
                await smtp.DisconnectAsync(true);

                Logger.Info($"[PlatformEmailJob] Email sent successfully to {args.To}. Subject={args.Subject}. CredentialsSource={credentialsSource}");
            }
            catch (Exception ex)
            {
                Logger.Error($"[PlatformEmailJob] Failed for {args.To}. {BuildExceptionChain(ex)}", ex);
                throw;
            }
        }

        private static string GetSenderEmailForPlatform(string platformName)
        {
            if (string.IsNullOrWhiteSpace(platformName))
            {
                return "info@worldcartus.com";
            }

            if (platformName.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase))
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

        private static string GetEmailSectionPrefix(string platformName)
        {
            if (!string.IsNullOrWhiteSpace(platformName) &&
                platformName.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase))
            {
                return "EmailSettings:EasyFinora";
            }

            if (!string.IsNullOrWhiteSpace(platformName) &&
                (platformName.Contains("Prime Ship", StringComparison.OrdinalIgnoreCase) ||
                 platformName.Contains("Primeship", StringComparison.OrdinalIgnoreCase)))
            {
                return "EmailSettings:PrimeShip";
            }

            return "EmailSettings:WorldCart";
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

            var sb = new StringBuilder();
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

            return sb.ToString();
        }

    }
}
