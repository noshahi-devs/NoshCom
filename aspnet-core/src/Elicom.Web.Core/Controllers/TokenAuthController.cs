using Abp.Authorization;
using Abp.Authorization.Users;
using Abp.MultiTenancy;
using Abp.Net.Mail;
using Abp.Runtime.Caching;
using Abp.Runtime.Security;
using Elicom.Authentication.JwtBearer;
using Elicom.Authorization;
using Elicom.Authorization.Users;
using Elicom.Models.TokenAuth;
using Elicom.MultiTenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using System.Net;
using System.Net.Http;
using System.Net.Mail;
using System.Net.Sockets;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Elicom.Controllers
{
    [Route("api/[controller]/[action]")]
    public class TokenAuthController : ElicomControllerBase
    {
        private readonly LogInManager _logInManager;
        private readonly ITenantCache _tenantCache;
        private readonly TokenAuthConfiguration _configuration;
        private readonly UserManager _userManager;
        private readonly IConfiguration _appConfiguration;
        private readonly IEmailSender _emailSender;
        private readonly ICache _pendingMfaLoginsCache;
        private static readonly ConcurrentDictionary<string, PendingMfaLogin> PendingMfaLogins = new ConcurrentDictionary<string, PendingMfaLogin>();
        private const int MfaCodeExpirySeconds = 300;
        private const int MaxMfaAttempts = 5;

        private string GetAdminOtpSenderEmail(string tenancyName)
        {
            var normalizedTenant = (tenancyName ?? string.Empty).Trim().ToLowerInvariant();
            if (normalizedTenant.Contains("prime") || normalizedTenant.Contains("global"))
            {
                return "support@thesmartshop.uk";
            }
            return "support@thesmartshop.uk";
        }

        private string GetAdminOtpReceiverEmail()
        {
            return "noshahidevelopersinc@gmail.com";
        }

        public TokenAuthController(
            LogInManager logInManager,
            ITenantCache tenantCache,
            TokenAuthConfiguration configuration,
            UserManager userManager,
            IConfiguration appConfiguration,
            IEmailSender emailSender,
            ICacheManager cacheManager)
        {
            _logInManager = logInManager;
            _tenantCache = tenantCache;
            _configuration = configuration;
            _userManager = userManager;
            _appConfiguration = appConfiguration;
            _emailSender = emailSender;
            _pendingMfaLoginsCache = cacheManager.GetCache("PendingMfaLogins");
        }

        [HttpPost]
        public async Task<AuthenticateResultModel> Authenticate([FromBody] AuthenticateModel model)
        {
            var inputIdentifier = (model?.UserNameOrEmailAddress ?? string.Empty).Trim();
            var tenancyName = GetTenancyNameOrNull();
            var shouldAlertAsAdminAttempt = IsAdminIdentifier(inputIdentifier);

            if (string.IsNullOrWhiteSpace(tenancyName))
            {
                Logger.Warn($"[Login] Missing tenant context for Authenticate. Identifier={inputIdentifier}");
                throw new Abp.UI.UserFriendlyException("Missing platform context. Please sign in from the correct platform (tenant header is required).");
            }

            try
            {
                // MFA step 2: validate challenge/code and return pending token
                if (!string.IsNullOrWhiteSpace(model?.MfaChallengeId) && !string.IsNullOrWhiteSpace(model?.MfaCode))
                {
                    var mfaCompleted = CompleteMfaChallenge(model.MfaChallengeId, model.MfaCode);
                    if (mfaCompleted == null)
                    {
                        throw new Abp.UI.UserFriendlyException("Invalid or expired confirmation code.");
                    }

                    // Send admin-login success alert only after MFA is completed (actual login success).
                    try
                    {
                        var mfaUser = await _userManager.GetUserByIdAsync(mfaCompleted.UserId);
                        if (mfaUser != null)
                        {
                            var roles = await _userManager.GetRolesAsync(mfaUser);
                            var hasAdminRole = roles.Any(IsAdminRoleName);
                            var isAllowlistedAdmin = IsAdminEmailAllowed(mfaUser);
                            var isAdminIdentifier = IsAdminIdentifier(mfaCompleted.Identifier);

                            if (isAdminIdentifier || isAllowlistedAdmin || hasAdminRole)
                            {
                                _ = TrySendAdminLoginAlertAsync(
                                    identifier: mfaCompleted.Identifier ?? inputIdentifier,
                                    tenancyName: mfaCompleted.TenantName ?? tenancyName,
                                    success: true,
                                    failureReason: null,
                                    matchedUser: mfaUser);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Logger.Warn($"[SecurityAlert] Could not evaluate admin login alert after MFA. {ex.Message}");
                    }

                    return new AuthenticateResultModel
                    {
                        AccessToken = mfaCompleted.AccessToken,
                        EncryptedAccessToken = mfaCompleted.EncryptedAccessToken,
                        ExpireInSeconds = mfaCompleted.ExpireInSeconds,
                        UserId = mfaCompleted.UserId
                    };
                }

                Logger.Info($"[Login] Authenticating user: {model.UserNameOrEmailAddress}");
                var loginResult = await GetLoginResultAsync(model.UserNameOrEmailAddress, model.Password, tenancyName);
                var loginUser = loginResult.User;

                // Keep login behavior consistent with JWT validation (see AuthConfigurer.ValidateUserStatusAsync).
                // Otherwise the UI may "login" but every subsequent API call returns 401 and the app bounces back to /auth.
                if (loginUser == null || loginUser.IsDeleted || !loginUser.IsActive)
                {
                    throw new Abp.UI.UserFriendlyException("Your account is inactive. Please contact support.");
                }

                if (!loginUser.IsEmailConfirmed)
                {
                    throw new Abp.UI.UserFriendlyException("Your email address has not been verified yet. Please check your inbox for the verification link to activate your account.");
                }

                var loginUserIsAllowlistedAdmin = IsAdminEmailAllowed(loginUser);
                var loginUserRoles = await _userManager.GetRolesAsync(loginUser);
                var loginUserHasAdminRole = loginUserRoles.Any(IsAdminRoleName);
                if (!loginUserHasAdminRole &&
                    (IsAdminIdentifier(loginUser?.UserName) || IsAdminIdentifier(loginUser?.EmailAddress)))
                {
                    // Fallback for rare tenant-context role-resolution issues on login.
                    loginUserHasAdminRole = true;
                    Logger.Warn($"[MFA] Admin identifier fallback applied for user {loginUser?.Id} ({loginUser?.UserName}/{loginUser?.EmailAddress}).");
                }

                if (shouldAlertAsAdminAttempt || loginUserIsAllowlistedAdmin || loginUserHasAdminRole)
                {
                    // Delay the success alert until we actually return a token (or MFA completion).
                }

                var accessToken = CreateAccessToken(await CreateJwtClaims(loginResult.Identity, loginUser));
                var encryptedToken = GetEncryptedAccessToken(accessToken);

                var shouldRequireMfa = await ShouldRequireMfa(loginUser, loginUserHasAdminRole);
                if (!shouldRequireMfa)
                {
                    if (shouldAlertAsAdminAttempt || loginUserIsAllowlistedAdmin || loginUserHasAdminRole)
                    {
                        _ = TrySendAdminLoginAlertAsync(inputIdentifier, tenancyName, true, null, loginUser);
                    }

                    return new AuthenticateResultModel
                    {
                        AccessToken = accessToken,
                        EncryptedAccessToken = encryptedToken,
                        ExpireInSeconds = (int)_configuration.Expiration.TotalSeconds,
                        UserId = loginUser.Id
                    };
                }

                // MFA step 1: issue confirmation code and hold token until code verification
                var code = GenerateSixDigitCode();
                var challengeId = Guid.NewGuid().ToString("N");
                var destinationEmail = ResolveMfaDestinationEmail(loginUser, loginUserHasAdminRole, tenancyName);

                // Do not return an MFA challenge unless we successfully sent the code.
                var (emailSent, emailFailureReason) = await SendMfaCodeEmailAsync(destinationEmail, code, loginUser, tenancyName);
                if (!emailSent)
                {
                    Logger.Warn($"[MFA] OTP email delivery failed. User={loginUser?.Id}, To={destinationEmail}, Reason={emailFailureReason}");
                    return new AuthenticateResultModel
                    {
                        Message = "Could not send confirmation code email. Please contact support."
                    };
                }

                PendingMfaLogins[challengeId] = new PendingMfaLogin
                {
                    ChallengeId = challengeId,
                    Code = code,
                    UserId = loginUser.Id,
                    AccessToken = accessToken,
                    EncryptedAccessToken = encryptedToken,
                    ExpireInSeconds = (int)_configuration.Expiration.TotalSeconds,
                    DestinationEmail = destinationEmail,
                    Identifier = inputIdentifier,
                    TenantName = tenancyName,
                    CreatedAtUtc = DateTime.UtcNow,
                    ExpiresAtUtc = DateTime.UtcNow.AddSeconds(MfaCodeExpirySeconds),
                    Attempts = 0
                };
                StorePendingMfaLoginCacheItem(PendingMfaLogins[challengeId]);
                CleanupExpiredMfaChallenges();

                return new AuthenticateResultModel
                {
                    MfaRequired = true,
                    MfaChallengeId = challengeId,
                    MfaExpireInSeconds = MfaCodeExpirySeconds,
                    MfaDestinationMasked = MaskEmail(destinationEmail),
                    MfaMessage = "A confirmation code has been sent to your email. Enter it to continue login."
                };
            }
            catch (Abp.UI.UserFriendlyException)
            {
                if (shouldAlertAsAdminAttempt)
                {
                    _ = TrySendAdminLoginAlertAsync(
                        identifier: inputIdentifier,
                        tenancyName: tenancyName,
                        success: false,
                        failureReason: "Invalid credentials or blocked by policy.",
                        matchedUser: null);
                }

                throw; // These are expected
            }
            catch (Exception ex)
            {
                Logger.Error("Authenticate failed", ex);
                throw new Abp.UI.UserFriendlyException("An internal error occurred during login. Please contact support. Details: " + ex.Message);
            }
        }

        private string GetTenancyNameOrNull()
        {
            int? tenantId = AbpSession.TenantId;

            // Fallback for manual header if session is not populated (sometimes happens in some middleware configurations)
            if (!tenantId.HasValue && Request.Headers.TryGetValue("Abp-TenantId", out var headerValue))
            {
                if (int.TryParse(headerValue, out var id))
                {
                    tenantId = id;
                }
            }

            if (!tenantId.HasValue)
            {
                return null;
            }

            return _tenantCache.GetOrNull(tenantId.Value)?.TenancyName;
        }

        private async Task<AbpLoginResult<Tenant, User>> GetLoginResultAsync(string usernameOrEmailAddress, string password, string tenancyName)
        {
            var hasTenantContext = !string.IsNullOrWhiteSpace(tenancyName);
            var loginResult = await _logInManager.LoginAsync(usernameOrEmailAddress, password, tenancyName);

            // Hide Platform Prefixes Support: If login fails and we have a tenant context, try prefixing
            if (loginResult.Result == AbpLoginResultType.InvalidUserNameOrEmailAddress && hasTenantContext)
            {
                string prefix = "";
                switch (tenancyName.ToLower())
                {
                    case "globalpay": prefix = "GP_"; break;
                    case "primeship": prefix = "PS_"; break;
                    case "default": prefix = "SS_"; break;
                    case "smartstore": prefix = "SS_"; break;
                }

                if (!string.IsNullOrEmpty(prefix) && !usernameOrEmailAddress.StartsWith(prefix))
                {
                    var prefixedLoginResult = await _logInManager.LoginAsync(prefix + usernameOrEmailAddress, password, tenancyName);
                    if (prefixedLoginResult.Result == AbpLoginResultType.Success)
                    {
                        return prefixedLoginResult;
                    }
                    
                    // If we found the user but password was wrong, keep that result for the final switch
                    if (prefixedLoginResult.Result != AbpLoginResultType.InvalidUserNameOrEmailAddress)
                    {
                        loginResult = prefixedLoginResult;
                    }
                }
            }

            // Cross-tenant fallback is allowed only when no explicit tenant context is supplied.
            // This prevents signing into Platform B with an account that exists only in Platform A.
            if (loginResult.Result == AbpLoginResultType.InvalidUserNameOrEmailAddress && !hasTenantContext)
            {
                using (UnitOfWorkManager.Current.DisableFilter(Abp.Domain.Uow.AbpDataFilters.MayHaveTenant, Abp.Domain.Uow.AbpDataFilters.MustHaveTenant))
                {
                    // Prioritize current tenant if identifiable
                    int? currentTenantId = string.IsNullOrEmpty(tenancyName) ? null : _tenantCache.GetOrNull(tenancyName)?.Id;

                    var users = await _userManager.Users
                        .IgnoreQueryFilters()
                        .Where(u => u.EmailAddress == usernameOrEmailAddress || u.UserName == usernameOrEmailAddress)
                        .ToListAsync();

                    var user = users.FirstOrDefault(u => u.TenantId == currentTenantId) ?? users.FirstOrDefault();

                    if (user != null)
                    {
                        var tenant = user.TenantId.HasValue ? _tenantCache.GetOrNull(user.TenantId.Value) : null;
                        var targetTenancyName = tenant?.TenancyName; 

                        var globalLoginResult = await _logInManager.LoginAsync(user.UserName, password, targetTenancyName);
                        if (globalLoginResult.Result == AbpLoginResultType.Success)
                        {
                            return globalLoginResult;
                        }

                        // If user exists anywhere but login fails (e.g. wrong password), capture that result
                        loginResult = globalLoginResult;
                    }
                }
            }

            switch (loginResult.Result)
            {
                case AbpLoginResultType.Success:
                    return loginResult;
                case AbpLoginResultType.InvalidUserNameOrEmailAddress:
                    if (hasTenantContext)
                    {
                        throw new Abp.UI.UserFriendlyException("No account was found for this platform. Please sign up first, then sign in.");
                    }
                    throw new Abp.UI.UserFriendlyException("Invalid email address or username. Please ensure you are using the correct credentials or register if you haven't yet.");
                case AbpLoginResultType.InvalidPassword:
                    throw new Abp.UI.UserFriendlyException("Invalid password. Please try again.");
                case AbpLoginResultType.UserIsNotActive:
                    throw new Abp.UI.UserFriendlyException("Your account is currently inactive. Please contact the system administrator for assistance or to request activation.");
                case AbpLoginResultType.InvalidTenancyName:
                    throw new Abp.UI.UserFriendlyException("Invalid tenant name.");
                case AbpLoginResultType.TenantIsNotActive:
                    throw new Abp.UI.UserFriendlyException("Tenant is not active.");
                case AbpLoginResultType.UserEmailIsNotConfirmed:
                    throw new Abp.UI.UserFriendlyException("Your email address has not been verified yet. Please check your inbox for the verification link to activate your account.");
                case AbpLoginResultType.LockedOut:
                    throw new Abp.UI.UserFriendlyException("Your account has been locked due to multiple failed login attempts. Please try again later.");
                default:
                    throw new Abp.UI.UserFriendlyException("Login failed. Please check your credentials and try again.");
            }
        }

        private string CreateAccessToken(IEnumerable<Claim> claims, TimeSpan? expiration = null)
        {
            var now = DateTime.UtcNow;

            var jwtSecurityToken = new JwtSecurityToken(
                issuer: _configuration.Issuer,
                audience: _configuration.Audience,
                claims: claims,
                notBefore: now,
                expires: now.Add(expiration ?? _configuration.Expiration),
                signingCredentials: _configuration.SigningCredentials
            );

            return new JwtSecurityTokenHandler().WriteToken(jwtSecurityToken);
        }

        private async Task<List<Claim>> CreateJwtClaims(ClaimsIdentity identity, User user)
        {
            var claims = identity.Claims.ToList();
            var nameIdClaim = claims.First(c => c.Type == ClaimTypes.NameIdentifier);
            const string securityStampClaimType = "AspNet.Identity.SecurityStamp";

            if (user?.TenantId.HasValue == true &&
                !claims.Any(c => string.Equals(c.Type, AbpClaimTypes.TenantId, StringComparison.Ordinal)))
            {
                claims.Add(new Claim(AbpClaimTypes.TenantId, user.TenantId.Value.ToString()));
            }

            // Add profile info to claims
            string fullName = $"{user.Name} {user.Surname}".Trim();
            if (!string.IsNullOrEmpty(fullName))
            {
                claims.Add(new Claim("name", fullName)); // Standard OIDC name claim
            }
            
            if (!string.IsNullOrEmpty(user.Name))
            {
                claims.Add(new Claim(ClaimTypes.GivenName, user.Name));
            }
            if (!string.IsNullOrEmpty(user.Surname))
            {
                claims.Add(new Claim(ClaimTypes.Surname, user.Surname));
            }

            // Explicit fail-safe: Add roles if missing from identity
            var roles = (await _userManager.GetRolesAsync(user)).ToList();
            var hasAdminRole = roles.Any(IsAdminRoleName) || claims.Any(IsAdminRoleClaim);
            var adminAllowed = IsAdminEmailAllowed(user);
            if (hasAdminRole && !adminAllowed)
            {
                claims.RemoveAll(IsAdminRoleClaim);
                roles = roles.Where(r => !IsAdminRoleName(r)).ToList();
                Logger.Warn($"[Auth] Admin role removed from token for {user.EmailAddress} (TenantId={user.TenantId}). Not in allowlist.");
            }

            foreach (var roleName in roles)
            {
                if (!claims.Any(c => c.Type == ClaimTypes.Role && c.Value == roleName))
                {
                    claims.Add(new Claim(ClaimTypes.Role, roleName));
                }
            }

            // Bind token validity to current user security stamp so DB stamp updates can revoke tokens instantly.
            if (string.IsNullOrWhiteSpace(user.SecurityStamp))
            {
                user.SecurityStamp = Guid.NewGuid().ToString("N");
                await _userManager.UpdateAsync(user);
            }
            claims.RemoveAll(c => string.Equals(c.Type, securityStampClaimType, StringComparison.Ordinal));
            claims.Add(new Claim(securityStampClaimType, user.SecurityStamp));

            // Specifically add the jti (random nonce), iat (issued timestamp), and sub (subject/user) claims.
            claims.AddRange(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, nameIdClaim.Value),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.Now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
            });

            return claims;
        }

        private bool IsAdminEmailAllowed(User user)
        {
            var email = (user?.EmailAddress ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
            {
                return false;
            }

            var allowlist = GetAdminAllowlistForTenant(user?.TenantId);
            if (allowlist.Count == 0)
            {
                Logger.Warn($"[Auth] Admin allowlist missing or empty for tenant {user?.TenantId}. Blocking admin role for {email}.");
                return false;
            }

            return allowlist.Contains(email);
        }

        private HashSet<string> GetAdminAllowlistForTenant(int? tenantId)
        {
            var keys = new List<string>();
            switch (tenantId)
            {
                case 1:
                    keys.Add("AdminAllowlist:WorldCartUS");
                    break;
                case 2:
                    keys.Add("AdminAllowlist:PrimeShipUK");
                    break;
                case 3:
                case 4:
                    keys.Add("AdminAllowlist:EasyFinora");
                    break;
                default:
                    keys.Add("AdminAllowlist:Default");
                    break;
            }

            foreach (var key in keys)
            {
                var raw = _appConfiguration[key];
                var parsed = ParseAllowlist(raw);
                if (parsed.Count > 0)
                {
                    return parsed;
                }
            }

            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        private static HashSet<string> ParseAllowlist(string raw)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(raw))
            {
                return set;
            }

            var parts = raw.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in parts)
            {
                var trimmed = part.Trim();
                if (!string.IsNullOrWhiteSpace(trimmed))
                {
                    set.Add(trimmed.ToLowerInvariant());
                }
            }

            return set;
        }

        private static bool IsAdminRoleName(string roleName)
        {
            return string.Equals(roleName, Authorization.Roles.StaticRoleNames.Tenants.Admin, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsAdminRoleClaim(Claim claim)
        {
            if (claim == null)
            {
                return false;
            }

            var isRoleClaim = claim.Type == ClaimTypes.Role ||
                              claim.Type.Equals("role", StringComparison.OrdinalIgnoreCase);
            return isRoleClaim && IsAdminRoleName(claim.Value);
        }

        private bool IsAdminIdentifier(string identifier)
        {
            var normalized = (identifier ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return false;
            }

            return normalized == "admin" ||
                   normalized == "secureadmin@wc.com" ||
                   normalized == "secureadmin@ps.com" ||
                   normalized == "secureadmin@ef.com" ||
                   normalized == "ss_secureadmin@wc.com" ||
                   normalized == "ps_secureadmin@ps.com" ||
                   normalized == "gp_secureadmin@ef.com";
        }

        private async Task TrySendAdminLoginAlertAsync(string identifier, string tenancyName, bool success, string failureReason, User matchedUser)
        {
            try
            {
                var ip = GetClientIpAddress();
                var location = await ResolveIpLocationAsync(ip);
                var userAgent = Request?.Headers["User-Agent"].ToString() ?? "Unknown";
                var device = GetDeviceDescription(userAgent);
                var tenantHeader = Request?.Headers["Abp-TenantId"].ToString() ?? string.Empty;
                var notifyTo = GetAdminOtpReceiverEmail();

                var (fromAddress, fromDisplayName) = ResolveEmailFrom(tenancyName);

                var subject = success
                    ? $"[SECURITY ALERT] Admin Login Success: {identifier}"
                    : $"[SECURITY ALERT] Admin Login Failed: {identifier}";

                var matchedEmail = matchedUser?.EmailAddress ?? "Unknown";
                var matchedUserName = matchedUser?.UserName ?? "Unknown";
                var nowUtc = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'");

                var body = $@"
Security Alert: Admin Login Attempt

Time (UTC): {nowUtc}
Status: {(success ? "SUCCESS" : "FAILED")}
Attempted Identifier: {identifier}
Failure Reason: {(string.IsNullOrWhiteSpace(failureReason) ? "N/A" : failureReason)}

Matched User Email: {matchedEmail}
Matched Username: {matchedUserName}
Tenant Name: {tenancyName ?? "N/A"}
Tenant Header (Abp-TenantId): {(string.IsNullOrWhiteSpace(tenantHeader) ? "N/A" : tenantHeader)}

IP Address: {ip}
Approx Location: {location}
Device: {device}
User-Agent: {userAgent}
";

                var mail = new MailMessage
                {
                    Subject = subject,
                    Body = body,
                    IsBodyHtml = false
                };
                mail.From = new MailAddress(fromAddress, fromDisplayName);
                mail.To.Add(notifyTo);

                await _emailSender.SendAsync(mail);
            }
            catch (Exception ex)
            {
                Logger.Warn($"[SecurityAlert] Could not send admin login alert to {GetAdminOtpReceiverEmail()}. {ex}");
            }
        }

        private string GetClientIpAddress()
        {
            var forwarded = Request?.Headers["X-Forwarded-For"].ToString();
            if (!string.IsNullOrWhiteSpace(forwarded))
            {
                var first = forwarded.Split(',').FirstOrDefault()?.Trim();
                if (!string.IsNullOrWhiteSpace(first))
                {
                    return first;
                }
            }

            var realIp = Request?.Headers["X-Real-IP"].ToString();
            if (!string.IsNullOrWhiteSpace(realIp))
            {
                return realIp.Trim();
            }

            return HttpContext?.Connection?.RemoteIpAddress?.ToString() ?? "Unknown";
        }

        private async Task<string> ResolveIpLocationAsync(string ipAddress)
        {
            if (string.IsNullOrWhiteSpace(ipAddress) || string.Equals(ipAddress, "Unknown", StringComparison.OrdinalIgnoreCase))
            {
                return "Unknown";
            }

            if (IPAddress.TryParse(ipAddress, out var parsedIp) &&
                (IPAddress.IsLoopback(parsedIp) || parsedIp.AddressFamily == AddressFamily.InterNetworkV6 && parsedIp.IsIPv6LinkLocal))
            {
                return "Local/Loopback";
            }

            try
            {
                using (var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) })
                {
                    var url = $"http://ip-api.com/json/{Uri.EscapeDataString(ipAddress)}?fields=status,country,regionName,city,isp,query";
                    var response = await http.GetAsync(url);
                    if (!response.IsSuccessStatusCode)
                    {
                        return "Unknown";
                    }

                    var json = await response.Content.ReadAsStringAsync();
                    using (var doc = JsonDocument.Parse(json))
                    {
                        var root = doc.RootElement;
                        var status = root.TryGetProperty("status", out var statusElement) ? statusElement.GetString() : null;
                        if (!string.Equals(status, "success", StringComparison.OrdinalIgnoreCase))
                        {
                            return "Unknown";
                        }

                        var city = root.TryGetProperty("city", out var cityElement) ? cityElement.GetString() : "";
                        var region = root.TryGetProperty("regionName", out var regionElement) ? regionElement.GetString() : "";
                        var country = root.TryGetProperty("country", out var countryElement) ? countryElement.GetString() : "";
                        var isp = root.TryGetProperty("isp", out var ispElement) ? ispElement.GetString() : "";
                        var query = root.TryGetProperty("query", out var queryElement) ? queryElement.GetString() : ipAddress;

                        return $"{city}, {region}, {country} (ISP: {isp}, IP: {query})";
                    }
                }
            }
            catch
            {
                return "Unknown";
            }
        }

        private static string GetDeviceDescription(string userAgent)
        {
            var ua = (userAgent ?? string.Empty).ToLowerInvariant();

            var os = ua.Contains("windows") ? "Windows" :
                     ua.Contains("android") ? "Android" :
                     ua.Contains("iphone") || ua.Contains("ipad") || ua.Contains("ios") ? "iOS" :
                     ua.Contains("mac os") || ua.Contains("macintosh") ? "macOS" :
                     ua.Contains("linux") ? "Linux" : "Unknown OS";

            var browser = ua.Contains("edg/") ? "Edge" :
                          ua.Contains("chrome/") ? "Chrome" :
                          ua.Contains("firefox/") ? "Firefox" :
                          ua.Contains("safari/") && !ua.Contains("chrome/") ? "Safari" :
                          "Unknown Browser";

            var deviceType = ua.Contains("mobile") ? "Mobile" :
                             ua.Contains("tablet") || ua.Contains("ipad") ? "Tablet" :
                             "Desktop";

            return $"{deviceType} | {os} | {browser}";
        }

        private static string GenerateSixDigitCode()
        {
            return RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");
        }

        private string ResolveMfaDestinationEmail(User user, bool hasAdminRole, string tenancyName)
        {
            if (hasAdminRole)
            {
                return GetAdminOtpReceiverEmail();
            }

            return (user?.EmailAddress ?? string.Empty).Trim();
        }

        private async Task<bool> ShouldRequireMfa(User user, bool hasAdminRole)
        {
            if (user == null)
            {
                return false;
            }

            // Admin users in any tenant require MFA
            if (hasAdminRole)
            {
                return true;
            }

            // Non-admin MFA only for WorldCart sellers (TenantId = 1)
            if (user.TenantId == 1)
            {
                var roles = await _userManager.GetRolesAsync(user);
                return roles.Any(r => string.Equals(r, Authorization.Roles.StaticRoleNames.Tenants.Seller, StringComparison.OrdinalIgnoreCase));
            }

            return false;
        }

        private static string MaskEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email) || !email.Contains("@"))
            {
                return "***";
            }

            var parts = email.Split('@');
            var local = parts[0];
            var domain = parts[1];

            if (local.Length <= 2)
            {
                return $"**@{domain}";
            }

            return $"{local.Substring(0, 2)}***@{domain}";
        }

        private PendingMfaLogin CompleteMfaChallenge(string challengeId, string code)
        {
            if (!TryGetPendingMfaLogin(challengeId, out var pending))
            {
                Logger.Warn($"[MFA] Challenge not found. ChallengeId={challengeId}");
                return null;
            }

            if (pending.ExpiresAtUtc < DateTime.UtcNow)
            {
                RemovePendingMfaLogin(challengeId);
                Logger.Warn($"[MFA] Challenge expired. ChallengeId={challengeId} ExpiredAtUtc={pending.ExpiresAtUtc:O} NowUtc={DateTime.UtcNow:O}");
                return null;
            }

            pending.Attempts++;
            if (pending.Attempts > MaxMfaAttempts)
            {
                RemovePendingMfaLogin(challengeId);
                Logger.Warn($"[MFA] Challenge locked after max attempts. ChallengeId={challengeId}");
                return null;
            }

            if (!string.Equals((code ?? string.Empty).Trim(), pending.Code, StringComparison.Ordinal))
            {
                UpdatePendingMfaLogin(pending);
                Logger.Warn($"[MFA] Invalid code for challenge. ChallengeId={challengeId} Attempts={pending.Attempts}");
                return null;
            }

            RemovePendingMfaLogin(challengeId);
            return pending;
        }

        private void CleanupExpiredMfaChallenges()
        {
            var now = DateTime.UtcNow;
            foreach (var item in PendingMfaLogins)
            {
                if (item.Value.ExpiresAtUtc < now)
                {
                    RemovePendingMfaLogin(item.Key);
                }
            }
        }

        private bool TryGetPendingMfaLogin(string challengeId, out PendingMfaLogin pending)
        {
            if (PendingMfaLogins.TryGetValue(challengeId, out pending))
            {
                return true;
            }

            try
            {
                var raw = _pendingMfaLoginsCache.GetOrDefault(challengeId) as string;
                if (string.IsNullOrWhiteSpace(raw))
                {
                    pending = null;
                    return false;
                }

                var cacheItem = JsonSerializer.Deserialize<PendingMfaLoginCacheItem>(raw);
                if (cacheItem == null || string.IsNullOrWhiteSpace(cacheItem.ChallengeId))
                {
                    pending = null;
                    return false;
                }

                pending = cacheItem.ToPendingMfaLogin();
                PendingMfaLogins[challengeId] = pending;
                return true;
            }
            catch (Exception ex)
            {
                Logger.Warn($"[MFA] Failed reading pending MFA challenge from cache. ChallengeId={challengeId}. {ex.Message}");
                pending = null;
                return false;
            }
        }

        private void UpdatePendingMfaLogin(PendingMfaLogin pending)
        {
            if (pending == null || string.IsNullOrWhiteSpace(pending.ChallengeId))
            {
                return;
            }

            PendingMfaLogins[pending.ChallengeId] = pending;
            StorePendingMfaLoginCacheItem(pending);
        }

        private void RemovePendingMfaLogin(string challengeId)
        {
            if (string.IsNullOrWhiteSpace(challengeId))
            {
                return;
            }

            PendingMfaLogins.TryRemove(challengeId, out _);

            try
            {
                _pendingMfaLoginsCache.Remove(challengeId);
            }
            catch (Exception ex)
            {
                Logger.Warn($"[MFA] Failed removing pending MFA challenge from cache. ChallengeId={challengeId}. {ex.Message}");
            }
        }

        private void StorePendingMfaLoginCacheItem(PendingMfaLogin pending)
        {
            if (pending == null || string.IsNullOrWhiteSpace(pending.ChallengeId))
            {
                return;
            }

            try
            {
                var cacheItem = PendingMfaLoginCacheItem.FromPending(pending);
                var raw = JsonSerializer.Serialize(cacheItem);
                _pendingMfaLoginsCache.Set(pending.ChallengeId, raw, TimeSpan.FromSeconds(MfaCodeExpirySeconds), null);
            }
            catch (Exception ex)
            {
                Logger.Warn($"[MFA] Failed storing pending MFA challenge in cache. ChallengeId={pending?.ChallengeId}. {ex.Message}");
            }
        }

        private async Task<(bool sent, string failureReason)> SendMfaCodeEmailAsync(string destinationEmail, string code, User user, string tenancyName)
        {
            var recipient = (destinationEmail ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(recipient))
            {
                Logger.Warn($"[MFA] No destination email for user {user?.Id}");
                return (false, "Missing recipient email");
            }

            var (fromAddress, fromDisplayName) = ResolveEmailFrom(tenancyName);
            var subject = $"Your {fromDisplayName} Login Confirmation Code";
            var body = $@"
Hello,

Your login confirmation code is: {code}

This code expires in {MfaCodeExpirySeconds / 60} minutes.
Tenant: {tenancyName ?? "N/A"}
User: {user?.EmailAddress ?? "N/A"}
Time (UTC): {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}

If this wasn't you, please reset your password immediately.
";

            var normalizedTenant = (tenancyName ?? string.Empty).Trim().ToLowerInvariant();
            var tenantKey = normalizedTenant.Contains("prime") ? "PrimeShip" : normalizedTenant.Contains("finora") ? "EasyFinora" : "WorldCart";
            
            var smtpHost = FirstNonEmpty(_appConfiguration[$"EmailSettings:{tenantKey}:SmtpHost"], _appConfiguration["EmailSettings:SmtpHost"], _appConfiguration["Settings:Abp.Net.Mail.Smtp.Host"], "mail.thesmartshop.uk");
            var portString = FirstNonEmpty(_appConfiguration[$"EmailSettings:{tenantKey}:Port"], _appConfiguration["EmailSettings:Port"], _appConfiguration["Settings:Abp.Net.Mail.Smtp.Port"]);
            var smtpPort = int.TryParse(portString, out var p) ? p : 465;

            var smtpUser = FirstNonEmpty(_appConfiguration[$"EmailSettings:{tenantKey}:Username"], _appConfiguration["EmailSettings:Username"], _appConfiguration["Settings:Abp.Net.Mail.Smtp.UserName"], GetAdminOtpSenderEmail(tenancyName));
            var smtpPass = FirstNonEmpty(_appConfiguration[$"EmailSettings:{tenantKey}:Password"], _appConfiguration["EmailSettings:Password"], _appConfiguration["Settings:Abp.Net.Mail.Smtp.Password"], _appConfiguration["SecurityAlerts:AdminOtpAppPassword"]);
            var sslString = FirstNonEmpty(_appConfiguration[$"EmailSettings:{tenantKey}:EnableSsl"], _appConfiguration["EmailSettings:EnableSsl"], _appConfiguration["Settings:Abp.Net.Mail.Smtp.EnableSsl"]);
            var enableSsl = bool.TryParse(sslString, out var s) ? s : true;

            fromAddress = GetAdminOtpSenderEmail(tenancyName);
            fromDisplayName = FirstNonEmpty(fromDisplayName, "Elicom");

            if (string.IsNullOrWhiteSpace(smtpPass))
            {
                Logger.Error("[MFA] SMTP app password is missing for admin OTP sender.");
                return (false, "SMTP app password is missing");
            }

            var recipientLog = recipient;
            Logger.Info($"[MFA] Sending confirmation code to {recipientLog} via {smtpHost}:{smtpPort} (TLS={enableSsl}).");

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(fromDisplayName, fromAddress));
                message.To.Add(MailboxAddress.Parse(recipient));
                message.Subject = subject;
                message.Body = new TextPart("plain") { Text = body };

                using (var smtp = new MailKit.Net.Smtp.SmtpClient())
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
                        Logger.Warn($"[MFA] Connect failed on port 465 with error: {ex.Message}. Retrying on port 587 with STARTTLS...");
                        try
                        {
                            await smtp.ConnectAsync(smtpHost, 587, SecureSocketOptions.StartTls);
                        }
                        catch (Exception fallbackEx)
                        {
                            Logger.Error($"[MFA] Fallback connect to port 587 also failed: {fallbackEx.Message}");
                            throw;
                        }
                    }
                    await smtp.AuthenticateAsync(smtpUser, smtpPass);
                    await smtp.SendAsync(message);
                    await smtp.DisconnectAsync(true);
                }

                Logger.Info($"[MFA] Confirmation code email sent to {recipientLog}.");
                return (true, null);
            }
            catch (Exception ex)
            {
                var chain = BuildExceptionChain(ex);
                Logger.Error($"[MFA] Could not send confirmation code email. To={recipientLog}, Host={smtpHost}, Port={smtpPort}. Details={chain}", ex);
                return (false, chain);
            }
        }

        private (string fromAddress, string fromDisplayName) ResolveEmailFrom(string tenancyName)
        {
            var normalizedTenant = (tenancyName ?? string.Empty).Trim().ToLowerInvariant();

            var tenantKey = normalizedTenant.Contains("prime")
                ? "PrimeShip"
                : normalizedTenant.Contains("finora")
                    ? "EasyFinora"
                    : "WorldCart";

            var defaultDisplayName = tenantKey == "PrimeShip"
                ? "Prime Ship"
                : tenantKey == "EasyFinora"
                    ? "Easy Finora"
                    : "WorldCart US";

            var fromAddress = FirstNonEmpty(
                _appConfiguration["Settings:Abp.Net.Mail.DefaultFromAddress"],
                _appConfiguration["EmailSettings:FromAddress"],
                _appConfiguration[$"EmailSettings:{tenantKey}:FromAddress"],
                "no-reply@worldcartus.com");

            var fromDisplayName = FirstNonEmpty(
                _appConfiguration[$"EmailSettings:{tenantKey}:FromDisplayName"],
                defaultDisplayName,
                _appConfiguration["Settings:Abp.Net.Mail.DefaultFromDisplayName"],
                "Elicom");

            return (fromAddress, fromDisplayName);
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
                if (!string.IsNullOrWhiteSpace(current.Message))
                {
                    sb.Append(": ").Append(current.Message);
                }

                current = current.InnerException;
                depth++;
            }

            return sb.ToString();
        }

        private string GetEncryptedAccessToken(string accessToken)
        {
            return SimpleStringCipher.Instance.Encrypt(accessToken);
        }

        private class PendingMfaLogin
        {
            public string ChallengeId { get; set; }
            public string Code { get; set; }
            public long UserId { get; set; }
            public string Identifier { get; set; }
            public string TenantName { get; set; }
            public string AccessToken { get; set; }
            public string EncryptedAccessToken { get; set; }
            public int ExpireInSeconds { get; set; }
            public string DestinationEmail { get; set; }
            public DateTime CreatedAtUtc { get; set; }
            public DateTime ExpiresAtUtc { get; set; }
            public int Attempts { get; set; }
        }

        private class PendingMfaLoginCacheItem
        {
            public string ChallengeId { get; set; }
            public string Code { get; set; }
            public long UserId { get; set; }
            public string Identifier { get; set; }
            public string TenantName { get; set; }
            public string AccessToken { get; set; }
            public string EncryptedAccessToken { get; set; }
            public int ExpireInSeconds { get; set; }
            public string DestinationEmail { get; set; }
            public DateTime CreatedAtUtc { get; set; }
            public DateTime ExpiresAtUtc { get; set; }
            public int Attempts { get; set; }

            public static PendingMfaLoginCacheItem FromPending(PendingMfaLogin pending)
            {
                return new PendingMfaLoginCacheItem
                {
                    ChallengeId = pending.ChallengeId,
                    Code = pending.Code,
                    UserId = pending.UserId,
                    Identifier = pending.Identifier,
                    TenantName = pending.TenantName,
                    AccessToken = pending.AccessToken,
                    EncryptedAccessToken = pending.EncryptedAccessToken,
                    ExpireInSeconds = pending.ExpireInSeconds,
                    DestinationEmail = pending.DestinationEmail,
                    CreatedAtUtc = pending.CreatedAtUtc,
                    ExpiresAtUtc = pending.ExpiresAtUtc,
                    Attempts = pending.Attempts
                };
            }

            public PendingMfaLogin ToPendingMfaLogin()
            {
                return new PendingMfaLogin
                {
                    ChallengeId = ChallengeId,
                    Code = Code,
                    UserId = UserId,
                    Identifier = Identifier,
                    TenantName = TenantName,
                    AccessToken = AccessToken,
                    EncryptedAccessToken = EncryptedAccessToken,
                    ExpireInSeconds = ExpireInSeconds,
                    DestinationEmail = DestinationEmail,
                    CreatedAtUtc = CreatedAtUtc,
                    ExpiresAtUtc = ExpiresAtUtc,
                    Attempts = Attempts
                };
            }
        }
    }
}
