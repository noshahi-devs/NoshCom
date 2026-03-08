using Abp.Authorization;
using Abp.Authorization.Users;
using Elicom.Authorization;
using Abp.Net.Mail;
using Abp.Runtime.Caching;
using Abp.UI;
using Abp.Domain.Uow;
using Abp.BackgroundJobs;
using Elicom.Authorization.Accounts.Dto;
using Elicom.Authorization.Users;
using Elicom.Authorization.Roles;
using Elicom.BackgroundJobs;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text;
using MimeKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Abp.Configuration;

namespace Elicom.Authorization.Accounts;

[Abp.Domain.Uow.UnitOfWork(System.Transactions.TransactionScopeOption.Suppress)]
public class AccountAppService : ElicomAppServiceBase, IAccountAppService
{
    // from: http://regexlib.com/REDetails.aspx?regexp_id=1923
    public const string PasswordRegex = "(?=^.{8,}$)(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?!.*\\s)[0-9a-zA-Z!@#$%^&*()]*$";

    private readonly UserRegistrationManager _userRegistrationManager;
    private readonly IEmailSender _emailSender;
    private readonly UserManager _userManager;
    private readonly RoleManager _roleManager;
    private readonly IPermissionManager _permissionManager;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;
    private readonly IBackgroundJobManager _backgroundJobManager;

    public AccountAppService(
        UserRegistrationManager userRegistrationManager,
        IEmailSender emailSender,
        UserManager userManager,
        RoleManager roleManager,
        IPermissionManager permissionManager,
        Microsoft.Extensions.Configuration.IConfiguration configuration,
        IBackgroundJobManager backgroundJobManager)
    {
        _userRegistrationManager = userRegistrationManager;
        _emailSender = emailSender;
        _userManager = userManager;
        _roleManager = roleManager;
        _permissionManager = permissionManager;
        _configuration = configuration;
        _backgroundJobManager = backgroundJobManager;
    }

    [HttpGet]
    public virtual async Task<ContentResult> VerifyEmail(long userId, string token, string platform = "Prime Ship")
    {
        Logger.Info($"VerifyEmail: Attempting to verify user {userId} for platform {platform}");

        User user;
        // Search directly using EF Core IgnoreQueryFilters to bypass all visibility rules
        user = await _userManager.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
        
        if (user == null) 
        {
            Logger.Error($"VerifyEmail: User {userId} not found even with IgnoreQueryFilters.");
            throw new UserFriendlyException("User not found");
        }

        Logger.Info($"VerifyEmail: User {userId} found. TenantId={user.TenantId}. Proceeding to confirm token.");

        // Set the tenant context to the user's actual tenant (e.g., Tenant 3) for confirmation
        using (UnitOfWorkManager.Current.SetTenantId(user.TenantId))
        {
            var result = await _userManager.ConfirmEmailAsync(user, token);
            if (result.Succeeded)
            {
                user.IsActive = true;
                await _userManager.UpdateAsync(user);

                // Get ClientRootAddress from platform-specific settings
                string clientRootAddressSetting = "App.SmartStore.ClientRootAddress";
                if (platform == "Prime Ship" || platform == "Prime Ship UK") clientRootAddressSetting = "App.PrimeShip.ClientRootAddress";
                if (platform == "Easy Finora") clientRootAddressSetting = "App.EasyFinora.ClientRootAddress";

                var clientRootAddress = (await SettingManager.GetSettingValueAsync(clientRootAddressSetting))?.TrimEnd('/');
                if (string.IsNullOrEmpty(clientRootAddress)) clientRootAddress = "http://localhost:4200";

                string redirectPath = $"{clientRootAddress}/account/login";
                if (platform == "Smart Store" || platform == "World Cart" || platform == "World Cart US") 
                {
                    // Use production domain unless it's a local development environment
                    redirectPath = clientRootAddress.Contains("localhost") ? $"{clientRootAddress}/smartstore/auth" : "https://worldcartus.com/smartstore/auth";
                }
            if (platform == "Prime Ship" || platform == "Prime Ship UK") redirectPath = $"{clientRootAddress}/auth/login";
            if (platform == "Easy Finora") redirectPath = $"{clientRootAddress}/auth";

                string primaryColor = "#000000";
                string icon = "&#x2705;";

                if (platform.Contains("Prime Ship")) { primaryColor = "#F85606"; icon = "&#x1F6A2;"; }
                else if (platform.Contains("Easy Finora")) { primaryColor = "#28a745"; icon = "&#x1F4B0;"; }

                // Non-blocking post-verification welcome email
                try
                {
                    await QueueWelcomeAfterVerificationEmailAsync(user, platform);
                }
                catch (Exception ex)
                {
                    Logger.Warn($"VerifyEmail: Could not enqueue welcome email for {user.EmailAddress}. {ex.Message}");
                }

                return new ContentResult
                {
                    ContentType = "text/html",
                    Content = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>{platform} - Verified</title>
    <style>
        body {{ margin:0; padding:0; height:100vh; display:flex; align-items:center; justify-content:center; background:#f9fafb; font-family: sans-serif; }}
        .card {{ background:white; padding:50px; border-radius:16px; box-shadow:0 10px 25px rgba(0,0,0,0.05); text-align:center; max-width:400px; width:90%; border:1px solid #eee; }}
        .icon {{ font-size:60px; margin-bottom:20px; }}
        h1 {{ color:{primaryColor}; margin:0 0 10px; font-size:24px; text-transform:uppercase; letter-spacing:1px; }}
        p {{ color:#4b5563; font-size:15px; line-height:1.5; margin-bottom:30px; }}
        .loader {{ width:20px; height:20px; border:3px solid #eee; border-top:3px solid {primaryColor}; border-radius:50%; animation: spin 0.8s linear infinite; display:inline-block; vertical-align:middle; margin-right:10px; }}
        @keyframes spin {{ 0% {{ transform: rotate(0deg); }} 100% {{ transform: rotate(360deg); }} }}
        .footer {{ font-size:12px; color:#9ca3af; margin-top:20px; font-weight:bold; }}
    </style>
</head>
<body>
    <div class='card'>
        <div class='icon'>{icon}</div>
        <h1>{platform}</h1>
        <p>Your account has been successfully verified! You can now access all features of our platform.</p>
        <div style='background:#f3f4f6; padding:12px; border-radius:8px; display:inline-block;'>
            <div class='loader'></div>
            <span style='font-size:14px; color:#1f2937; font-weight:600;'>Redirecting to login...</span>
        </div>
        <div class='footer'>{platform.ToUpper()} US</div>
    </div>
    <script>
        setTimeout(function() {{
            window.location.href = '{redirectPath}';
        }}, 3000);
    </script>
</body>
</html>"
                };
            }
        }

        throw new UserFriendlyException("Invalid or expired verification token");
    }

    public async Task<IsTenantAvailableOutput> IsTenantAvailable(IsTenantAvailableInput input)
    {
        var tenant = await TenantManager.FindByTenancyNameAsync(input.TenancyName);
        if (tenant == null)
        {
            return new IsTenantAvailableOutput(TenantAvailabilityState.NotFound);
        }

        if (!tenant.IsActive)
        {
            return new IsTenantAvailableOutput(TenantAvailabilityState.InActive);
        }

        return new IsTenantAvailableOutput(TenantAvailabilityState.Available, tenant.Id);
    }

    [HttpPost]
    public async Task<RegisterOutput> Register(RegisterInput input)
    {
        try
        {
            var user = await _userRegistrationManager.RegisterAsync(
                input.Name,
                input.Surname,
                input.EmailAddress,
                input.UserName,
                input.Password,
                false, // Email address is NOT confirmed by default.
                input.PhoneNumber,
                input.Country
            );

            var tenantId = AbpSession.TenantId ?? 1;
            string platformName = "Elicom";
            string brandColor = "#007bff";

            if (tenantId == 1) { platformName = "World Cart"; brandColor = "#000000"; }
            else if (tenantId == 2) { platformName = "Prime Ship UK"; brandColor = "#f85606"; }
            else if (tenantId == 3) { platformName = "Easy Finora"; brandColor = "#1de016"; }
            else if (tenantId == 4) { platformName = "Easy Finora"; brandColor = "#28a745"; }

            // 5. Verification Email (Smart 5s Timeout)
            try
            {
                await SendVerificationEmail(user, platformName, brandColor);
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Register] Email delay/error: {ex.Message}");
            }

            return new RegisterOutput
            {
                CanLogin = user.IsActive && user.IsEmailConfirmed
            };
        }
        catch (Exception ex)
        {
             throw new UserFriendlyException($"Registration Error: {ex.Message} | Inner: {ex.InnerException?.Message}");
        }
    }

    private async Task SendVerificationEmail(User user, string platformName, string brandColor)
    {
        var serverRootAddress = (await SettingManager.GetSettingValueAsync("App.ServerRootAddress"))?.TrimEnd('/');
        if (string.IsNullOrEmpty(serverRootAddress)) serverRootAddress = "http://localhost:44311";

        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var verificationLink = $"{serverRootAddress}/api/services/app/Account/VerifyEmail?userId={user.Id}&token={Uri.EscapeDataString(token)}&platform={Uri.EscapeDataString(platformName)}";

        // var emailBody = $@"
        //     <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;'>
        //         <div style='text-align: center; border-bottom: 2px solid {brandColor}; padding-bottom: 15px;'>
        //             <h1 style='color: #333; margin: 0;'>{platformName.ToUpper()}</h1>
        //         </div>
        //         <div style='padding: 30px; line-height: 1.6; color: #333;'>
        //             <h2>Welcome to {platformName}!</h2>
        //             <p>Hi <b>{user.Name}</b>,</p>
        //             <p>You've successfully registered on {platformName}.</p>
        //             <div style='text-align: center; margin: 35px 0;'>
        //                 <a href='{verificationLink}' style='background-color: {brandColor}; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 18px;'>
        //                     VERIFY MY ACCOUNT
        //                 </a>
        //             </div>
        //         </div>
        //     </div>";

        // Platform-specific email templates for complete brand separation
        string emailBody;

        if (platformName.Contains("Prime Ship"))
        {
            // PRIME SHIP UK - Compact Professional Theme (Orange to match website)
            emailBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin:0; padding:0; background-color:#fff5f0; font-family: ""Segoe UI"", Tahoma, Geneva, Verdana, sans-serif;'>

    <table width='100%' cellpadding='0' cellspacing='0' style='background-color:#fff5f0; padding:30px 20px;'>
        <tr>
            <td align='center'>

                <table width='600' cellpadding='0' cellspacing='0' style='background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 20px rgba(248,86,6,0.15);'>
                    
                    <!-- Compact Header with Orange Theme -->
                    <tr>
                        <td style='background: linear-gradient(135deg, #F85606 0%, #FF2E00 100%); padding:25px 30px; text-align:center;'>
                            <div style='display:inline-block; background:rgba(255,255,255,0.15); width:60px; height:60px; border-radius:50%; line-height:60px; margin-bottom:10px; border:2px solid rgba(255,255,255,0.3);'>
                                <span style='font-size:30px;'>&#x1F6A2;</span>
                            </div>
                            <h1 style='margin:0; color:#ffffff; font-size:26px; font-weight:700; letter-spacing:2px;'>
                                PRIME SHIP UK
                            </h1>
                            <p style='margin:5px 0 0; color:rgba(255,255,255,0.9); font-size:12px;'>Your Trusted Wholesale Partner</p>
                        </td>
                    </tr>

                    <!-- Compact Body -->
                    <tr>
                        <td style='padding:30px 35px; color:#2c3e50; font-size:15px; line-height:1.6;'>

                            <h2 style='margin:0 0 15px; font-weight:600; color:#F85606; font-size:20px;'>Verify Your Account</h2>

                            <p style='margin:0 0 12px;'>Dear <strong>{(string.IsNullOrEmpty(user.Name) ? user.UserName : user.Name)}</strong>,</p>

                            <p style='margin:0 0 18px;'>
                                Welcome to Prime Ship UK! Please verify your email to access our wholesale marketplace.
                            </p>

                            <!-- CTA Button -->
                            <table width='100%' cellpadding='0' cellspacing='0' style='margin:25px 0;'>
                                <tr>
                                    <td align='center'>
                                        <a href='{verificationLink}' 
                                           style='background: linear-gradient(135deg, #F85606 0%, #FF2E00 100%);
                                                  color:#ffffff; 
                                                  padding:14px 40px; 
                                                  text-decoration:none; 
                                                  border-radius:6px; 
                                                  font-weight:700; 
                                                  font-size:15px;
                                                  display:inline-block;
                                                  box-shadow: 0 4px 12px rgba(248,86,6,0.3);
                                                  text-transform:uppercase;
                                                  letter-spacing:0.5px;'>
                                            Verify Email
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style='font-size:12px; color:#7f8c8d; background:#fff9e6; padding:12px; border-radius:5px; margin:0 0 18px; border-left:3px solid #ffc107;'>
                                This link expires in 24 hours. Didn't sign up? Ignore this email.
                            </p>

                            <p style='margin:0; font-size:14px; color:#2c3e50;'>
                                Kind Regards,<br/>
                                <strong style='color:#F85606;'>Prime Ship UK Team</strong>
                            </p>

                        </td>
                    </tr>

                    <!-- Compact Footer with Orange Theme -->
                    <tr>
                        <td style='background:#F85606; padding:18px 30px; text-align:center;'>
                            <p style='margin:0; font-size:12px; color:rgba(255,255,255,0.95);'>
                                London, UK | support@primeshipuk.com
                            </p>
                            <p style='margin:8px 0 0; font-size:11px; color:rgba(255,255,255,0.8);'>
                                &copy; {DateTime.UtcNow.Year} Prime Ship UK. All rights reserved.
                            </p>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>";
        }
        else if (platformName == "Easy Finora")
        {
            // EASY FINORA - Keep existing green financial theme (DON'T TOUCH)
            emailBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
</head>
<body style='margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, Helvetica, sans-serif;'>

    <table width='100%' cellpadding='0' cellspacing='0' style='background-color:#f4f6f8; padding:40px 0;'>
        <tr>
            <td align='center'>

                <table width='600' cellpadding='0' cellspacing='0' style='background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05);'>
                    
                    <!-- Header -->
                    <tr>
                        <td style='background:{brandColor}; padding:20px 30px; text-align:center;'>
                            <h1 style='margin:0; color:#ffffff; font-size:24px; letter-spacing:1px;'>
                                {platformName}
                            </h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style='padding:40px 30px; color:#333333; font-size:15px; line-height:1.6;'>

                            <h2 style='margin-top:0; font-weight:600;'>Confirm Your Email Address</h2>

                            <p>Dear {user.Name},</p>

                            <p>
                                Thank you for registering with <strong>{platformName}</strong>. 
                                To complete your account setup, please confirm your email address by clicking the button below.
                            </p>

                            <table width='100%' cellpadding='0' cellspacing='0' style='margin:30px 0;'>
                                <tr>
                                    <td align='center'>
                                        <a href='{verificationLink}' 
                                           style='background:{brandColor}; 
                                                  color:#ffffff; 
                                                  padding:14px 28px; 
                                                  text-decoration:none; 
                                                  border-radius:5px; 
                                                  font-weight:bold; 
                                                  font-size:15px;
                                                  display:inline-block;'>
                                            Verify Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style='font-size:13px; color:#666;'>
                                If the button above does not work, please copy and paste the following link into your browser:
                            </p>

                            <p style='word-break:break-all; font-size:12px; color:#888;'>
                                {verificationLink}
                            </p>

                            <hr style='border:none; border-top:1px solid #eee; margin:30px 0;' />

                            <p style='font-size:13px; color:#777;'>
                                If you did not create this account, please ignore this email.
                                This verification link may expire for security reasons.
                            </p>

                            <p style='margin-top:30px;'>
                                Best Regards,<br/>
                                <strong>{platformName} Team</strong>
                            </p>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style='background:#f9fafb; padding:20px 30px; text-align:center; font-size:12px; color:#999;'>
                            &copy; {DateTime.UtcNow.Year} {platformName}. All rights reserved.
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>";
        }
        else // World Cart or other platforms
        {
            // WORLD CART - Welcome + verification template
            var roles = await _userManager.GetRolesAsync(user);
            bool isSeller = roles.Any(r => r.ToLower().Contains("seller") || r.ToLower().Contains("supplier"));
            string accountType = isSeller ? "Seller Account" : "Customer Account";
            string userDisplayName = string.IsNullOrWhiteSpace(user.Name) ? user.UserName : user.Name;
            string roleSpecificEnding = isSeller
                ? "Thank you for choosing WORLD CART. We look forward to helping you grow your business!"
                : "Thank you for choosing WORLD CART. We look forward to serving you!";

            emailBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='background-color:#f3f4f6; padding:24px 12px;'>
        <tr>
            <td align='center'>
                <table width='600' cellpadding='0' cellspacing='0' style='max-width:600px; width:100%; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;'>
                    <tr>
                        <td style='background:#000000; padding:26px 22px; text-align:center;'>
                            <h1 style='margin:0; color:#ffffff; font-size:42px; font-weight:700; line-height:1.15;'>
                                Welcome to WORLD CART!
                            </h1>
                            <p style='margin:12px 0 0; color:#efeefe; font-size:15px;'>
                                {accountType}
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding:30px 24px; color:#111827; font-size:15px; line-height:1.55;'>
                            <p style='margin:0 0 16px;'>Dear {userDisplayName},</p>
                            <p style='margin:0 0 16px;'>
                                Congratulations and welcome to WORLD CART! We are thrilled to have you join our community.
                            </p>
                            <p style='margin:0 0 16px;'>
                                Your account has been successfully created, and you are now ready to start exploring and utilizing all the features we offer.
                            </p>
                            <p style='margin:0 0 16px;'>
                                To get started, please verify your email address.
                            </p>
                            <table width='100%' cellpadding='0' cellspacing='0' style='margin:18px 0 22px;'>
                                <tr>
                                    <td align='center'>
                                        <a href='{verificationLink}'
                                           style='background:#000000; color:#ffffff; padding:13px 26px; text-decoration:none; border-radius:4px; font-weight:700; font-size:17px; display:inline-block;'>
                                            Click here to verify!
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style='margin:0 0 16px;'>
                                If you have any questions or need assistance, our support team is here to help.
                            </p>
                            <p style='margin:0 0 16px;'>
                                {roleSpecificEnding}
                            </p>
                            <p style='font-size:13px; color:#6b7280; background:#f9fafb; padding:12px; border-radius:6px; margin:18px 0 0; border:1px solid #e5e7eb;'>
                                This verification link expires in 24 hours.<br/>
                                If the button doesn't work, copy this link:<br/>
                                <span style='word-break:break-all; color:#4f46e5;'>{verificationLink}</span>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style='border-top:1px solid #e5e7eb; padding:20px; text-align:center; background:#ffffff;'>
                            <p style='margin:0; font-size:13px; font-weight:700; color:#111827;'>WORLD CART US</p>
                            <p style='margin:8px 0 0; font-size:12px; color:#6b7280;'>
                                &copy; {DateTime.UtcNow.Year} World Cart Inc. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
        }



        // Platform-specific email subjects
        string emailSubject;
        if (platformName == "Prime Ship")
        {
            emailSubject = "Verify Your Prime Ship UK Account - Wholesale Access Awaits";
        }
        else if (platformName == "Easy Finora")
        {
            emailSubject = "Action Required: Verify Your Easy Finora Account";
        }
        else if (platformName.Contains("World Cart", StringComparison.OrdinalIgnoreCase) ||
                 platformName.Contains("Smart Store", StringComparison.OrdinalIgnoreCase))
        {
            emailSubject = "Congratulations! You've Successfully Signed Up";
        }
        else
        {
            emailSubject = $"Verify Your {platformName} Account";
        }

        await SendEmailWithCustomSmtp(
            null,
            0,
            null,
            null,
            platformName,
            null, // senderAddress will be determined inside SendEmailWithCustomSmtp based on platformName
            user.EmailAddress,
            emailSubject,
            emailBody
        );
    }

    private async Task QueueWelcomeAfterVerificationEmailAsync(User user, string platform)
    {
        if (user == null || string.IsNullOrWhiteSpace(user.EmailAddress))
        {
            return;
        }

        var platformName = ResolvePlatformName(platform, user.TenantId);
        var roles = await _userManager.GetRolesAsync(user);
        var isSeller = roles.Any(r =>
            r.Contains("seller", StringComparison.OrdinalIgnoreCase) ||
            r.Contains("supplier", StringComparison.OrdinalIgnoreCase) ||
            r.Contains("reseller", StringComparison.OrdinalIgnoreCase));

        var subject = platformName.Contains("World Cart", StringComparison.OrdinalIgnoreCase)
            ? "Your Account is Verified - Welcome to WORLD CART"
            : $"Your {platformName} Account is Verified";

        var body = BuildWelcomeAfterVerificationEmailBody(
            user,
            platformName,
            isSeller);

        await _backgroundJobManager.EnqueueAsync<PlatformEmailJob, PlatformEmailJobArgs>(
            new PlatformEmailJobArgs
            {
                PlatformName = platformName,
                To = user.EmailAddress,
                Subject = subject,
                HtmlBody = body
            });
    }

    private string BuildWelcomeAfterVerificationEmailBody(User user, string platformName, bool isSeller)
    {
        var brandColor = platformName.Contains("Prime Ship", StringComparison.OrdinalIgnoreCase)
            ? "#f85606"
            : platformName.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase)
                ? "#28a745"
                : "#000000";

        var supportEmail = GetSenderEmailForPlatform(platformName);
        var userName = string.IsNullOrWhiteSpace(user?.Name) ? (user?.UserName ?? "User") : user.Name;

        var roleSpecificParagraph = isSeller
            ? "We've seen that you are setting up your seller presence, and we're thrilled to let you know your store can now move forward for customer visibility."
            : "Your account is now fully active, and you're all set to explore products, place orders, and enjoy our platform.";

        var closingLine = isSeller
            ? $"Thank you for choosing {platformName}. We look forward to helping you grow your business!"
            : $"Thank you for choosing {platformName}. We look forward to serving you!";

        var footerBrand = platformName.Contains("World Cart", StringComparison.OrdinalIgnoreCase)
            ? "WORLD CART US"
            : platformName.ToUpperInvariant();
        var footerCompany = platformName.Contains("World Cart", StringComparison.OrdinalIgnoreCase)
            ? "World Cart Inc."
            : platformName;

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin:0; padding:0; background:#f3f4f6; font-family: Arial, Helvetica, sans-serif;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='padding:24px 12px;'>
        <tr>
            <td align='center'>
                <table width='600' cellpadding='0' cellspacing='0' style='max-width:600px; width:100%; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;'>
                    <tr>
                        <td style='background:{brandColor}; padding:26px 22px; text-align:center;'>
                            <h1 style='margin:0; color:#ffffff; font-size:40px; font-weight:700; line-height:1.15;'>Your Account is Verified!</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding:30px 24px; color:#111827; font-size:15px; line-height:1.55;'>
                            <p style='margin:0 0 16px;'>Dear {userName},</p>
                            <p style='margin:0 0 16px;'><strong>We're excited to inform you that your account has been successfully verified!</strong></p>
                            <p style='margin:0 0 16px;'>{roleSpecificParagraph}</p>
                            <p style='margin:0 0 16px;'>If you have any questions or need assistance, our support team is here to help. Feel free to reach out to us at <a href='mailto:{supportEmail}' style='color:#2563eb; text-decoration:none;'>{supportEmail}</a>.</p>
                            <p style='margin:0 0 16px;'>{closingLine}</p>
                            <p style='margin:0;'>Best regards,<br/>{platformName} Team</p>
                        </td>
                    </tr>
                    <tr>
                        <td style='border-top:1px solid #e5e7eb; padding:20px; text-align:center; background:#ffffff;'>
                            <p style='margin:0; font-size:13px; font-weight:700; color:#111827;'>{footerBrand}</p>
                            <p style='margin:8px 0 0; font-size:12px; color:#6b7280;'>&copy; {DateTime.UtcNow.Year} {footerCompany} All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    private static string ResolvePlatformName(string platform, int? tenantId)
    {
        if (!string.IsNullOrWhiteSpace(platform))
        {
            if (platform.Contains("Prime Ship", StringComparison.OrdinalIgnoreCase)) return "Prime Ship UK";
            if (platform.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase)) return "Easy Finora";
            if (platform.Contains("World Cart", StringComparison.OrdinalIgnoreCase) ||
                platform.Contains("Smart Store", StringComparison.OrdinalIgnoreCase)) return "World Cart";
        }

        return tenantId switch
        {
            2 => "Prime Ship UK",
            3 => "Easy Finora",
            _ => "World Cart"
        };
    }

    [HttpPost]
    public async Task RegisterSeller(string email)
    {
        await RegisterPrimeShipSeller(new RegisterPrimeShipInput 
        { 
            EmailAddress = email, 
            Password = "DefaultPassword123!", // Legacy support
            Country = "United Kingdom",
            PhoneNumber = "0000000000"
        });
    }

    [HttpPost]
    public async Task RegisterSmartStoreSeller(RegisterSmartStoreInput input)
    {
        await RegisterPlatformUser(input.EmailAddress, 1, StaticRoleNames.Tenants.Seller, "Seller", "World Cart", "WC", "#000000", input.Password, input.Country, input.PhoneNumber, input.FullName);
    }

    [HttpPost]
    public async Task RegisterSmartStoreCustomer(RegisterSmartStoreInput input)
    {
        await RegisterPlatformUser(input.EmailAddress, 1, StaticRoleNames.Tenants.Buyer, "Customer", "World Cart", "WC", "#000000", input.Password, input.Country, input.PhoneNumber, input.FullName);
    }

    [HttpPost]
    public async Task RegisterPrimeShipSeller(RegisterPrimeShipInput input)
    {
        await RegisterPlatformUser(input.EmailAddress, 2, StaticRoleNames.Tenants.Supplier, "Seller", "Prime Ship UK", "PS", "#f85606", input.Password, input.Country, input.PhoneNumber, input.FullName);
    }

    [HttpPost]
    public async Task RegisterPrimeShipCustomer(RegisterPrimeShipInput input)
    {
        await RegisterPlatformUser(input.EmailAddress, 2, StaticRoleNames.Tenants.Reseller, "Customer", "Prime Ship UK", "PS", "#f85606", input.Password, input.Country, input.PhoneNumber, input.FullName);
    }

    [HttpPost]
    public async Task RegisterGlobalPayUser(RegisterGlobalPayInput input)
    {
        await RegisterPlatformUser(input.EmailAddress, 3, StaticRoleNames.Tenants.Reseller, "User", "Easy Finora", "GP", "#28a745", input.Password, input.Country, input.PhoneNumber, input.FullName);
    }


    [HttpPost]
    public async Task SendSampleEmail()
    {
        const string toEmail = "noshahidevelopersinc@gmail.com";

        Logger.Info($"SendSampleEmail: Start sending sample email to {toEmail}. TenantId={AbpSession.TenantId}");

        await SendEmailWithCustomSmtp(
            null,
            0,
            null,
            null,
            "Easy Finora",
            null,
            toEmail,
            "Sample Email (Easy Finora Register)",
            "<div style='font-family: Arial, sans-serif;'>Sample email from backend API.</div>"
        );

        Logger.Info($"SendSampleEmail: Completed send attempt to {toEmail}.");
    }

    private async Task RegisterPlatformUser(string email, int tenantId, string roleName, string userType, string platformName, string prefix, string brandColor, string password = "Noshahi.000", string country = null, string phoneNumber = null, string fullName = null)
    {
        try 
        {
            var normalizedEmail = (email ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(normalizedEmail))
            {
                throw new UserFriendlyException("Email address is required.");
            }

            Logger.Info($"[Register] Starting registration process: Email={email}, TenantId={tenantId}, Role={roleName}, Platform={platformName}");
            
            // Split FullName into Name and Surname for ABP User entity
            string name = fullName ?? userType;
            string surname = "User";

            if (!string.IsNullOrEmpty(fullName))
            {
                var parts = fullName.Trim().Split(' ', 2);
                if (parts.Length > 1)
                {
                    name = parts[0];
                    surname = parts[1];
                }
                else
                {
                    name = parts[0];
                }
            }

            using (CurrentUnitOfWork.SetTenantId(tenantId))
            {
                string userName = $"{prefix}_{normalizedEmail}";
                Logger.Info($"[Register] Resolved UserName: {userName}. Checking for existing user...");

                // Enforce one Gmail/email per platform (tenant): duplicate signup is not allowed.
                // We also include prefix-mapped users (legacy/wrong-tenant records) to prevent duplicate accounts.
                var platformUsers = await _userManager.Users
                    .IgnoreQueryFilters()
                    .Where(u =>
                        (u.TenantId == tenantId || (u.UserName != null && u.UserName.StartsWith(prefix + "_"))) &&
                        u.EmailAddress != null)
                    .Select(u => new { u.EmailAddress, u.UserName })
                    .ToListAsync();

                var emailCanonicalKey = GetCanonicalEmailKey(normalizedEmail);
                var existingByEmail = platformUsers.Any(u =>
                    string.Equals((u.EmailAddress ?? string.Empty).Trim(), normalizedEmail, StringComparison.OrdinalIgnoreCase));
                var existingByUserName = platformUsers.Any(u =>
                    string.Equals(u.UserName ?? string.Empty, userName, StringComparison.OrdinalIgnoreCase));
                var existingByCanonicalGmail = platformUsers.Any(u =>
                    string.Equals(GetCanonicalEmailKey(u.EmailAddress), emailCanonicalKey, StringComparison.Ordinal));

                if (existingByEmail || existingByUserName || existingByCanonicalGmail)
                {
                    Logger.Warn($"[Register] Duplicate signup blocked for email '{normalizedEmail}' on tenant {tenantId}.");
                    throw new UserFriendlyException("An account with this email address already exists on this platform. Please sign in or use a different email address.");
                }

                Logger.Info($"[Register] User not found. Calling UserRegistrationManager.RegisterAsync...");
                // Create new user (RegisterAsync also handles Wallet creation and sets IsActive=true)
                var user = await _userRegistrationManager.RegisterAsync(
                    name,
                    surname,
                    normalizedEmail,
                    userName,
                    password,
                    false, // Email not confirmed
                    phoneNumber,
                    country
                );
                Logger.Info($"[Register] User created successfully. ID: {user.Id}");

                // 2. Role Management
                Logger.Info($"[Register] Verifying role '{roleName}' for tenant {tenantId}...");
                var role = await _roleManager.FindByNameAsync(roleName);
                if (role == null)
                {
                    Logger.Info($"[Register] Role '{roleName}' not found. Creating static role...");
                    role = new Elicom.Authorization.Roles.Role(tenantId, roleName, roleName) { IsStatic = true };
                    var roleResult = await _roleManager.CreateAsync(role);
                    if (!roleResult.Succeeded)
                    {
                        throw new UserFriendlyException($"Could not create role '{roleName}': {string.Join(", ", roleResult.Errors.Select(e => e.Description))}");
                    }
                    await CurrentUnitOfWork.SaveChangesAsync();
                    Logger.Info($"[Register] Role created. ID: {role.Id}");
                }

                // 3. Permission Management (Platform Specific)
                try 
                {
                    var platformPermissions = new List<string>();
                    
                    if (platformName.Contains("World Cart") || platformName.Contains("Smart Store"))
                    {
                        platformPermissions.Add(PermissionNames.Pages_SmartStore_Seller);
                        platformPermissions.Add(PermissionNames.Pages_Stores);
                        platformPermissions.Add(PermissionNames.Pages_Stores_Create);
                        platformPermissions.Add(PermissionNames.Pages_StoreProducts);
                        platformPermissions.Add(PermissionNames.Pages_StoreProducts_Create);
                        platformPermissions.Add(PermissionNames.Pages_StoreProducts_Edit);
                        platformPermissions.Add(PermissionNames.Pages_StoreProducts_Delete);
                    }
                    else if (platformName.Contains("Prime Ship") || platformName.Contains("Primeship"))
                    {
                        platformPermissions.Add(PermissionNames.Pages_PrimeShip);
                        platformPermissions.Add(PermissionNames.Pages_Stores);
                        platformPermissions.Add(PermissionNames.Pages_Stores_Create);
                        platformPermissions.Add(PermissionNames.Pages_StoreProducts);
                        platformPermissions.Add(PermissionNames.Pages_StoreProducts_Create);
                        platformPermissions.Add(PermissionNames.Pages_StoreProducts_Edit);
                        platformPermissions.Add(PermissionNames.Pages_StoreProducts_Delete);
                    }
                    else if (platformName.Contains("Easy Finora") || platformName.Contains("Global Pay"))
                    {
                        platformPermissions.Add(PermissionNames.Pages_GlobalPay);
                    }

                    if (platformPermissions.Any())
                    {
                        Logger.Info($"[Register] Ensuring permissions for role '{role.Name}': {string.Join(", ", platformPermissions)}");
                        var grantedPermissions = await _roleManager.GetGrantedPermissionsAsync(role);
                        var permissionsToGrant = platformPermissions
                            .Where(name => !grantedPermissions.Any(gp => gp.Name == name))
                            .Select(name => _permissionManager.GetPermission(name))
                            .ToList();

                        if (permissionsToGrant.Any())
                        {
                            await _roleManager.SetGrantedPermissionsAsync(role, grantedPermissions.Concat(permissionsToGrant));
                            await CurrentUnitOfWork.SaveChangesAsync();
                            Logger.Info($"[Register] Access granted for: {string.Join(", ", permissionsToGrant.Select(p => p.Name))}");
                        }
                    }
                }
                catch (Exception permEx)
                {
                    Logger.Warn($"[Register] Could not grant permissions for role {role.Name}: {permEx.Message}");
                }

                // 4. Role Assignment
                var currentRoles = await _userManager.GetRolesAsync(user);
                if (!currentRoles.Contains(roleName))
                {
                    Logger.Info($"[Register] Assigning role '{roleName}' to user '{userName}'...");
                    var assignResult = await _userManager.AddToRoleAsync(user, roleName);
                    if (!assignResult.Succeeded)
                    {
                        throw new UserFriendlyException($"Could not assign role: {string.Join(", ", assignResult.Errors.Select(e => e.Description))}");
                    }
                    await CurrentUnitOfWork.SaveChangesAsync();
                    Logger.Info($"[Register] Role assigned successfully.");
                }

                // 5. Verification Email (synchronous for reliability)
                try
                {
                    Logger.Info($"[Register] Sending verification email to {email}...");
                    await SendVerificationEmail(user, platformName, brandColor);
                    Logger.Info("[Register] Verification email sent.");
                }
                catch (Exception emailEx)
                {
                    Logger.Error($"[Register] Could not send email: {emailEx.Message}");
                }
            }
        }
        catch (UserFriendlyException) { throw; }
        catch (Exception ex)
        {
            Logger.Error($"[Register] CRITICAL REGISTRATION ERROR for {email}: {ex.Message}", ex);
            throw new UserFriendlyException($"Registration failed for '{email}'. Please contact support with this error: {ex.Message}");
        }
    }

    private static string GetCanonicalEmailKey(string email)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        var atIndex = normalized.IndexOf('@');
        if (atIndex <= 0 || atIndex == normalized.Length - 1)
        {
            return normalized;
        }

        var localPart = normalized.Substring(0, atIndex);
        var domainPart = normalized.Substring(atIndex + 1);

        // Gmail aliases should be treated as one address:
        // dots are ignored and +suffix is ignored by Gmail delivery.
        if (domainPart == "gmail.com" || domainPart == "googlemail.com")
        {
            var plusIndex = localPart.IndexOf('+');
            if (plusIndex >= 0)
            {
                localPart = localPart.Substring(0, plusIndex);
            }

            localPart = localPart.Replace(".", string.Empty);
            domainPart = "gmail.com";
        }

        return $"{localPart}@{domainPart}";
    }

    private async Task SendEmailWithCustomSmtp(string host, int port, string user, string pass, string fromName, string fromEmail, string to, string subject, string body)
    {
        var sectionPrefix = GetEmailSectionPrefix(fromName);

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
        var resolvedUser = user;
        var resolvedPass = pass;

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

        if (string.IsNullOrWhiteSpace(resolvedUser))
        {
            resolvedUser = FirstNonEmpty(sectionUser, emailSettingsUser, abpUser);
        }

        if (string.IsNullOrWhiteSpace(resolvedPass))
        {
            resolvedPass = FirstNonEmpty(sectionPass, emailSettingsPass, abpPass);
        }

        var resolvedHost = string.IsNullOrWhiteSpace(host)
            ? credentialsSource switch
            {
                "section" => FirstNonEmpty(sectionHost, emailSettingsHost, abpHost, "smtp-relay.brevo.com"),
                "email-settings" => FirstNonEmpty(emailSettingsHost, abpHost, sectionHost, "smtp-relay.brevo.com"),
                "abp-settings" => FirstNonEmpty(abpHost, emailSettingsHost, sectionHost, "smtp-relay.brevo.com"),
                _ => FirstNonEmpty(sectionHost, emailSettingsHost, abpHost, "smtp-relay.brevo.com")
            }
            : host;

        var configuredPort = credentialsSource switch
        {
            "section" => FirstNonEmpty(sectionPort, emailSettingsPort, abpPort),
            "email-settings" => FirstNonEmpty(emailSettingsPort, abpPort, sectionPort),
            "abp-settings" => FirstNonEmpty(abpPort, emailSettingsPort, sectionPort),
            _ => FirstNonEmpty(sectionPort, emailSettingsPort, abpPort)
        };

        if (port <= 0 && int.TryParse(configuredPort, out var parsedPort) && parsedPort > 0)
        {
            port = parsedPort;
        }
        if (port <= 0)
        {
            port = 587;
        }

        var senderEmail = fromEmail;
        if (string.IsNullOrWhiteSpace(senderEmail))
        {
            senderEmail = _configuration[$"{sectionPrefix}:FromAddress"];
        }
        if (string.IsNullOrWhiteSpace(senderEmail))
        {
            senderEmail = GetSenderEmailForPlatform(fromName);
        }
        if (string.IsNullOrWhiteSpace(senderEmail))
        {
            senderEmail = await SettingManager.GetSettingValueAsync(EmailSettingNames.DefaultFromAddress);
        }
        if (string.IsNullOrWhiteSpace(senderEmail))
        {
            senderEmail = "no-reply@worldcartus.com";
        }

        if (string.IsNullOrWhiteSpace(resolvedHost))
        {
            throw new UserFriendlyException("SMTP host is not configured.");
        }
        if (string.IsNullOrWhiteSpace(resolvedUser) || string.IsNullOrWhiteSpace(resolvedPass))
        {
            throw new UserFriendlyException("SMTP username/password are not configured.");
        }

        var enableSslRaw = credentialsSource switch
        {
            "section" => FirstNonEmpty(sectionEnableSsl, emailSettingsEnableSsl, abpEnableSsl, "true"),
            "email-settings" => FirstNonEmpty(emailSettingsEnableSsl, abpEnableSsl, sectionEnableSsl, "true"),
            "abp-settings" => FirstNonEmpty(abpEnableSsl, emailSettingsEnableSsl, sectionEnableSsl, "true"),
            _ => FirstNonEmpty(sectionEnableSsl, emailSettingsEnableSsl, abpEnableSsl, "true")
        };
        var enableSsl = !string.Equals(enableSslRaw, "false", StringComparison.OrdinalIgnoreCase);

        Logger.Info($"[SMTP] Sending email to {to} via {resolvedHost}:{port} (TLS={enableSsl}) using {credentialsSource} credentials as {senderEmail}.");

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName ?? "World Cart", senderEmail));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;
            message.Body = new TextPart("html") { Text = body };

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

            Logger.Info($"[SMTP] Email sent successfully to {to}.");
        }
        catch (Exception ex)
        {
            var exceptionChain = BuildExceptionChain(ex);
            Logger.Error(
                $"[SMTP] Email send failed. To={to}, Host={resolvedHost}, Port={port}, TLS={enableSsl}, Sender={senderEmail}, User={resolvedUser}. Details={exceptionChain}",
                ex
            );
            throw new UserFriendlyException($"Could not send verification email: {exceptionChain}");
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
        if (platformName.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase))
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

        var details = sb.ToString();
        return details.Length <= 1200 ? details : details[..1200];
    }

    private int min(int a, int b) => a < b ? a : b;


    [HttpPost]
    public async Task ForgotPassword(string email)
    {
        int tenantId = AbpSession.TenantId ?? 1;
        using (CurrentUnitOfWork.SetTenantId(tenantId))
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user == null) 
            {
                Logger.Warn($"ForgotPassword: User not found for email {email} in tenant {tenantId}");
                return;
            }

            Logger.Info($"ForgotPassword: Generating reset token for {email}");
            var serverRootAddress = (await SettingManager.GetSettingValueAsync("App.ServerRootAddress"))?.TrimEnd('/');
            if (string.IsNullOrEmpty(serverRootAddress)) serverRootAddress = "http://localhost:44311";

            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var resetLink = $"{serverRootAddress}/api/services/app/Account/ShowResetPasswordPage?userId={user.Id}&token={Uri.EscapeDataString(token)}";

            var emailBody = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f4f7f6;'>
                    <div style='text-align: center; padding-bottom: 20px;'>
                        <h2 style='color: #d9534f; font-weight: bold;'>Prime Ship UK</h2>
                        <h3 style='color: #333;'>Password Reset Request</h3>
                    </div>
                    <div style='background-color: #ffffff; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 4px solid #d9534f;'>
                        <p style='font-size: 16px; color: #555; line-height: 1.6;'>
                            We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
                        </p>
                        <div style='margin: 35px 0;'>
                            <a href='{resetLink}' 
                               style='background-color: #d9534f; color: #ffffff; padding: 18px 35px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 18px; display: inline-block;'>
                               RESET MY PASSWORD
                            </a>
                        </div>
                        <p style='font-size: 14px; color: #888;'>
                            For security reasons, this link will expire in 24 hours.
                        </p>
                    </div>
                    <div style='text-align: center; margin-top: 30px; color: #aaa; font-size: 12px;'>
                        If you're having trouble clicking the button, copy and paste this URL into your web browser:<br>
                        <a href='{resetLink}' style='color: #d9534f; word-break: break-all;'>{resetLink}</a>
                    </div>
                </div>";

            if (tenantId == 3 || tenantId == 4) // Easy Finora
            {
                await SendEmailWithCustomSmtp(
                    null,
                    0,
                    null,
                    null,
                    "Easy Finora",
                    null,
                    email,
                    "Reset Your Easy Finora Password",
                    emailBody
                );
            }
            else if (tenantId == 2) // Prime Ship
            {
                 await SendEmailWithCustomSmtp(
                    null,
                    0,
                    null,
                    null,
                    "Prime Ship UK",
                    null,
                    email,
                    "Reset Your Prime Ship Password",
                    emailBody
                );
            }
            else // Default (World Cart or other)
            {
                await SendEmailWithCustomSmtp(
                    null,
                    0,
                    null,
                    null,
                    "World Cart US",
                    null,
                    email,
                    "Reset Your Password",
                    emailBody
                );
            }
            Logger.Info($"ForgotPassword: Email sent to {email}");
        }
    }

    [HttpGet]
    public ContentResult ShowResetPasswordPage(long userId, string token)
    {
        // This is a simple HTML page to collect the new password
        return new ContentResult
        {
            ContentType = "text/html",
            Content = $@"
                <html>
                    <body style='font-family: sans-serif; display: flex; justify-content: center; padding-top: 100px; background-color: #f4f7f6;'>
                        <div style='background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 350px;'>
                            <h2 style='text-align: center; color: #333;'>Reset Password</h2>
                            <p style='font-size: 14px; color: #666; margin-bottom: 25px;'>Please enter your new password below.</p>
                            <input type='password' id='newPass' placeholder='New Password' style='width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 6px;'>
                            <button onclick='submitReset()' style='width: 100%; padding: 12px; background: #d9534f; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;'>Update Password</button>
                            <div id='msg' style='margin-top: 15px; text-align: center; font-size: 14px;'></div>
                        </div>
                        <script>
                            async function submitReset() {{
                                const pass = document.getElementById('newPass').value;
                                if (!pass) {{ alert('Please enter a password'); return; }}
                                
                                const response = await fetch('/api/services/app/Account/ResetPassword', {{
                                    method: 'POST',
                                    headers: {{ 'Content-Type': 'application/json' }},
                                    body: JSON.stringify({{ userId: {userId}, token: '{token}', newPassword: pass }})
                                }});
                                
                                if (response.ok) {{
                                    document.getElementById('msg').innerHTML = '<span style=""color: green"">Password updated! Redirecting...</span>';
                                    setTimeout(() => window.location.href = '/account/login', 2000);
                                }} else {{
                                    document.getElementById('msg').innerHTML = '<span style=""color: red"">Error resetting password. Link might be expired.</span>';
                                }}
                            }}
                        </script>
                    </body>
                </html>"
        };
    }

    [HttpPost]
    public async Task ResetPassword(ResetPasswordInput input)
    {
        var user = await _userManager.FindByIdAsync(input.UserId.ToString());
        if (user == null) throw new UserFriendlyException("User not found");

        var result = await _userManager.ResetPasswordAsync(user, input.Token, input.NewPassword);
        if (!result.Succeeded)
        {
            throw new UserFriendlyException("Failed to reset password: " + string.Join(", ", result.Errors.Select(e => e.Description)));
        }
    }
}

