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
                if (platform == "Smart Shop UK")
                {
                    redirectPath = clientRootAddress.Contains("localhost") ? $"{clientRootAddress}/smartstore/auth" : "https://thesmartshop.uk/smartstore/auth";
                }
                else if (platform == "Smart Store" || platform == "World Cart" || platform == "World Cart US") 
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
                else if (platform.Contains("Smart Shop UK") || platform.Contains("World Cart")) { primaryColor = "#F2BB13"; icon = "&#x2705;"; }

                // Non-blocking post-verification welcome email
                // DISABLED per request: A2 (Welcome after verification)
                // try
                // {
                //     await QueueWelcomeAfterVerificationEmailAsync(user, platform);
                // }
                // catch (Exception ex)
                // {
                //     Logger.Warn($"VerifyEmail: Could not enqueue welcome email for {user.EmailAddress}. {ex.Message}");
                // }

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
            var tenantId = AbpSession.TenantId ?? 1;
            var isPrimeShipSignup = tenantId == 2;
            var user = await _userRegistrationManager.RegisterAsync(
                input.Name,
                input.Surname,
                input.EmailAddress,
                input.UserName,
                input.Password,
                isPrimeShipSignup, // PrimeShip skips verification
                input.PhoneNumber,
                input.Country
            );

            string platformName = "Elicom";
            string brandColor = "#007bff";

            if (tenantId == 1) { platformName = "Smart Shop UK"; brandColor = "#F2BB13"; }
            else if (tenantId == 2) { platformName = "Prime Ship UK"; brandColor = "#f85606"; }
            else if (tenantId == 3) { platformName = "Easy Finora"; brandColor = "#1de016"; }
            else if (tenantId == 4) { platformName = "Easy Finora"; brandColor = "#28a745"; }

            if (isPrimeShipSignup)
            {
                user.IsActive = true;
                user.IsEmailConfirmed = true;
                await _userManager.UpdateAsync(user);
                Logger.Info("[Register] PrimeShip signup: email verification skipped.");
            }
            else
            {
                // 5. Verification Email (Smart 5s Timeout)
                try
                {
                    await SendVerificationEmail(user, platformName, brandColor);
                }
                catch (Exception ex)
                {
                    Logger.Warn($"[Register] Email delay/error: {ex.Message}");
                }
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

    private async Task TrySendVerificationEmailWithTimeoutAsync(User user, string platformName, string brandColor)
    {
        var sendTask = SendVerificationEmail(user, platformName, brandColor);
        var completedTask = await Task.WhenAny(sendTask, Task.Delay(TimeSpan.FromSeconds(8)));

        if (completedTask == sendTask)
        {
            await sendTask;
            return;
        }

        Logger.Warn($"[Register] {platformName} verification email timed out after 8 seconds. Registration will continue without waiting for SMTP.");
    }

    private async Task SendVerificationEmail(User user, string platformName, string brandColor)
    {
        if (platformName.Contains("Prime Ship", StringComparison.OrdinalIgnoreCase) ||
            platformName.Contains("Primeship", StringComparison.OrdinalIgnoreCase))
        {
            Logger.Info("[Register] PrimeShip verification email skipped by configuration.");
            return;
        }

        var serverRootAddress = (await SettingManager.GetSettingValueAsync("App.ServerRootAddress"))?.TrimEnd('/');
        if (string.IsNullOrEmpty(serverRootAddress)) serverRootAddress = "https://localhost:44311";

        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        
        // Ensure no double slashes in URL
        var cleanServerRoot = serverRootAddress?.TrimEnd('/', ' ') ?? "https://localhost:44311";
        var verificationLink = $"{cleanServerRoot}/api/services/app/Account/VerifyEmail?userId={user.Id}&token={Uri.EscapeDataString(token)}&platform={Uri.EscapeDataString(platformName)}";

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
        var userFullName = string.Join(" ",
                new[] { user?.Name, user?.Surname }.Where(x => !string.IsNullOrWhiteSpace(x)))
            .Trim();
        if (string.IsNullOrWhiteSpace(userFullName))
        {
            userFullName = user?.UserName ?? "User";
        }
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

                            <p>Dear {userFullName},</p>

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
                            &copy; 2022 {platformName}. All rights reserved.
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>";
        }
        else // Smart Shop UK or other platforms
        {
            // SMART SHOP UK - Welcome + verification template
            var roles = await _userManager.GetRolesAsync(user);
            bool isSeller = roles.Any(r => r.ToLower().Contains("seller") || r.ToLower().Contains("supplier"));
            string accountType = isSeller ? "Seller Account" : "Customer Account";
            string userDisplayName = userFullName;
            string roleSpecificEnding = isSeller
                ? "Thank you for choosing Smart Shop UK. We look forward to helping you grow your business!"
                : "Thank you for choosing Smart Shop UK. We look forward to serving you!";

            emailBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin:0; padding:0; background-color:#fffbeb; font-family: ""Segoe UI"", Arial, Helvetica, sans-serif;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='background-color:#fffbeb; padding:30px 12px;'>
        <tr>
            <td align='center'>
                <table width='600' cellpadding='0' cellspacing='0' style='max-width:600px; width:100%; background:#ffffff; border:1px solid #fde68a; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(242,187,19,0.08);'>

                    <!-- Header -->
                    <tr>
                        <td style='background:#F2BB13; padding:36px 28px; text-align:center;'>
                            <h1 style='margin:0; color:#111827; font-size:30px; font-weight:800; letter-spacing:1px;'>
                                Welcome to Smart Shop UK!
                            </h1>
                            <p style='margin:8px 0 0; color:#374151; font-size:14px; font-weight:600; letter-spacing:0.5px;'>
                                {accountType}
                            </p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style='padding:34px 32px; color:#1f2937; font-size:15px; line-height:1.65;'>
                            <p style='margin:0 0 16px;'>Dear <strong>{userDisplayName}</strong>,</p>
                            <p style='margin:0 0 16px;'>
                                Congratulations and welcome to <strong>Smart Shop UK</strong>! We are thrilled to have you join our community.
                            </p>
                            <p style='margin:0 0 16px;'>
                                Your account has been successfully created, and you are now ready to start exploring and utilising all the features we offer.
                            </p>
                            <p style='margin:0 0 20px;'>
                                To get started, please verify your email address by clicking the button below.
                            </p>

                            <!-- CTA Button -->
                            <table width='100%' cellpadding='0' cellspacing='0' style='margin:24px 0 28px;'>
                                <tr>
                                    <td align='center'>
                                        <a href='{verificationLink}'
                                           style='background:#F2BB13; color:#111827; padding:14px 38px; text-decoration:none; border-radius:7px; font-weight:700; font-size:16px; display:inline-block; letter-spacing:0.4px; box-shadow:0 4px 14px rgba(242,187,19,0.40);'>
                                            Verify My Account
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style='margin:0 0 14px;'>
                                If you have any questions or need assistance, our support team is here to help.
                            </p>
                            <p style='margin:0 0 20px;'>
                                {roleSpecificEnding}
                            </p>

                            <p style='margin:24px 0 0; font-size:14px; color:#374151;'>
                                Kind Regards,<br/>
                                <strong style='color:#b58500;'>Smart Shop UK Team</strong>
                            </p>
                        </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                        <td style='padding:0 32px;'>
                            <hr style='border:none; border-top:1px solid #e5e7eb; margin:0;' />
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style='padding:20px 32px; text-align:center; background:#fffbeb;'>
                            <p style='margin:0; font-size:13px; font-weight:700; color:#b58500; letter-spacing:0.5px;'>SMART SHOP UK</p>
                            <p style='margin:6px 0 0; font-size:12px; color:#6b7280;'>
                                &copy; {DateTime.UtcNow.Year} Smart Shop UK Ltd. All rights reserved.
                            </p>
                            <p style='margin:4px 0 0; font-size:11px; color:#9ca3af;'>support@smartshopuk.com</p>
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
                 platformName.Contains("Smart Store", StringComparison.OrdinalIgnoreCase) ||
                 platformName.Contains("Smart Shop UK", StringComparison.OrdinalIgnoreCase))
        {
            emailSubject = "Congratulations! You've Successfully Signed Up - Smart Shop UK";
        }
        else
        {
            emailSubject = $"Verify Your {platformName} Account";
        }

        if (platformName.Contains("Prime Ship", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await SendEmailWithCustomSmtp(
                    null,
                    0,
                    null,
                    null,
                    "Prime Ship UK",
                    null,
                    user.EmailAddress,
                    emailSubject,
                    emailBody
                );
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Register] PrimeShip SMTP failed. Falling back to default sender. {ex.Message}");
                try
                {
                    var mail = new System.Net.Mail.MailMessage
                    {
                        Subject = emailSubject,
                        Body = emailBody,
                        IsBodyHtml = true
                    };
                    mail.To.Add(user.EmailAddress);
                    await _emailSender.SendAsync(mail);
                }
                catch (Exception fallbackEx)
                {
                    Logger.Error($"[Register] PrimeShip fallback email failed for {user.EmailAddress}: {fallbackEx.Message}", fallbackEx);
                    throw;
                }
            }
        }
        else if (platformName.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await SendEmailWithCustomSmtp(
                    null,
                    0,
                    null,
                    null,
                    "Easy Finora",
                    null,
                    user.EmailAddress,
                    emailSubject,
                    emailBody
                );
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Register] EasyFinora SMTP failed. Falling back to default sender. {ex.Message}");
                try
                {
                    var mail = new System.Net.Mail.MailMessage
                    {
                        Subject = emailSubject,
                        Body = emailBody,
                        IsBodyHtml = true
                    };
                    mail.To.Add(user.EmailAddress);
                    await _emailSender.SendAsync(mail);
                }
                catch (Exception fallbackEx)
                {
                    Logger.Error($"[Register] EasyFinora fallback email failed for {user.EmailAddress}: {fallbackEx.Message}", fallbackEx);
                    throw;
                }
            }
        }
        else
        {
            try
            {
                await SendEmailWithCustomSmtp(
                    null,
                    0,
                    null,
                    null,
                    "Smart Shop UK",
                    null,
                    user.EmailAddress,
                    emailSubject,
                    emailBody
                );
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Register] SmartShopUK SMTP failed. Falling back to default sender. {ex.Message}");
                try
                {
                    var mail = new System.Net.Mail.MailMessage
                    {
                        Subject = emailSubject,
                        Body = emailBody,
                        IsBodyHtml = true
                    };
                    mail.To.Add(user.EmailAddress);
                    await _emailSender.SendAsync(mail);
                }
                catch (Exception fallbackEx)
                {
                    Logger.Error($"[Register] WorldCart fallback email failed for {user.EmailAddress}: {fallbackEx.Message}", fallbackEx);
                    throw;
                }
            }
        }
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
                platform.Contains("Smart Store", StringComparison.OrdinalIgnoreCase) ||
                platform.Contains("Smart Shop UK", StringComparison.OrdinalIgnoreCase)) return "Smart Shop UK";
        }

        return tenantId switch
        {
            2 => "Prime Ship UK",
            3 => "Easy Finora",
            _ => "Smart Shop UK"
        };
    }

    [HttpPost]
    public async Task RegisterSeller(string email)
    {
        await RegisterPrimeShipSeller(new RegisterPrimeShipInput 
        { 
            EmailAddress = email, 
            Password = User.DefaultPassword,
            Country = "United Kingdom",
            PhoneNumber = "0000000000"
        });
    }

    [HttpPost]
    public async Task RegisterSmartStoreSeller(RegisterSmartStoreInput input)
    {
        await RegisterPlatformUser(input.EmailAddress, 1, StaticRoleNames.Tenants.Seller, "Seller", "Smart Shop UK", "SS", "#F2BB13", input.Password, input.Country, input.PhoneNumber, input.FullName);
    }

    [HttpPost]
    public async Task RegisterSmartStoreCustomer(RegisterSmartStoreInput input)
    {
        await RegisterPlatformUser(input.EmailAddress, 1, StaticRoleNames.Tenants.Buyer, "Customer", "Smart Shop UK", "SS", "#F2BB13", input.Password, input.Country, input.PhoneNumber, input.FullName);
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

    private async Task RegisterPlatformUser(string email, int tenantId, string roleName, string userType, string platformName, string prefix, string brandColor, string password = null, string country = null, string phoneNumber = null, string fullName = null)
    {
        try 
        {
            if (string.IsNullOrWhiteSpace(password))
            {
                password = User.DefaultPassword;
            }

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
                var isPrimeShipSignup = platformName.Contains("Prime Ship", StringComparison.OrdinalIgnoreCase) ||
                                        platformName.Contains("Primeship", StringComparison.OrdinalIgnoreCase);

                // Create new user (RegisterAsync also handles Wallet creation and sets IsActive=true)
                var user = await _userRegistrationManager.RegisterAsync(
                    name,
                    surname,
                    normalizedEmail,
                    userName,
                    password,
                    isPrimeShipSignup, // PrimeShip skips verification
                    phoneNumber,
                    country
                );
                Logger.Info($"[Register] User created successfully. ID: {user.Id}");

                if (isPrimeShipSignup)
                {
                    user.IsActive = true;
                    user.IsEmailConfirmed = true;
                    await _userManager.UpdateAsync(user);
                    Logger.Info("[Register] PrimeShip signup: email verification skipped.");
                }

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
                    
                    if (platformName.Contains("World Cart") || platformName.Contains("Smart Store") || platformName.Contains("Smart Shop UK"))
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

                if (!isPrimeShipSignup)
                {
                    // 5. Verification Email
                    try
                    {
                        Logger.Info($"[Register] Sending verification email to {email}...");
                        if (platformName.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase))
                        {
                            await TrySendVerificationEmailWithTimeoutAsync(user, platformName, brandColor);
                        }
                        else
                        {
                            await SendVerificationEmail(user, platformName, brandColor);
                        }
                        Logger.Info("[Register] Verification email sent.");
                    }
                    catch (Exception emailEx)
                    {
                        Logger.Error($"[Register] Could not send email: {emailEx.Message}");
                    }
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
            message.From.Add(new MailboxAddress(fromName ?? "Smart Shop UK", senderEmail));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;
            message.Body = new TextPart("html") { Text = body };

            using (var smtp = new SmtpClient())
            {
                smtp.ServerCertificateValidationCallback = (smtpSender, certificate, chain, errors) => true;

                var secureMode = enableSsl
                     ? (port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls)
                     : SecureSocketOptions.None;

                var connected = false;
                try
                {
                    await smtp.ConnectAsync(resolvedHost, port, secureMode);
                    connected = true;
                }
                catch (Exception ex) when (port == 465)
                {
                    Logger.Warn($"[SMTP] Connect failed on port 465 with error: {ex.Message}. Retrying on port 587 with STARTTLS...");
                    try
                    {
                        await smtp.ConnectAsync(resolvedHost, 587, SecureSocketOptions.StartTls);
                        connected = true;
                    }
                    catch (Exception fallbackEx)
                    {
                        Logger.Error($"[SMTP] Fallback connect to port 587 also failed: {fallbackEx.Message}");
                        throw;
                    }
                }

                if (connected)
                {
                    if (!string.IsNullOrWhiteSpace(resolvedUser))
                    {
                        await smtp.AuthenticateAsync(resolvedUser, resolvedPass ?? string.Empty);
                    }

                    await smtp.SendAsync(message);
                    await smtp.DisconnectAsync(true);
                    Logger.Info($"[SMTP] Email sent successfully to {to}.");
                }
            }
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

}

