using Abp.Authorization;
using Abp.Authorization.Users;
using Abp.MultiTenancy;
using Abp.Runtime.Security;
using Elicom.Authentication.JwtBearer;
using Elicom.Authorization;
using Elicom.Authorization.Users;
using Elicom.Models.TokenAuth;
using Elicom.MultiTenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
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

        public TokenAuthController(
            LogInManager logInManager,
            ITenantCache tenantCache,
            TokenAuthConfiguration configuration,
            UserManager userManager)
        {
            _logInManager = logInManager;
            _tenantCache = tenantCache;
            _configuration = configuration;
            _userManager = userManager;
        }

        [HttpPost]
        public async Task<AuthenticateResultModel> Authenticate([FromBody] AuthenticateModel model)
        {
            try
            {
                Logger.Info($"[Login] 🔐 Authenticating user: {model.UserNameOrEmailAddress}");
                var loginResult = await GetLoginResultAsync(
                    model.UserNameOrEmailAddress,
                    model.Password,
                    GetTenancyNameOrNull()
                );

                Logger.Info($"[Login] ✅ Login successful for {model.UserNameOrEmailAddress} (ID: {loginResult.User.Id}). Generating token...");
                var accessToken = CreateAccessToken(await CreateJwtClaims(loginResult.Identity, loginResult.User));

                return new AuthenticateResultModel
                {
                    AccessToken = accessToken,
                    EncryptedAccessToken = GetEncryptedAccessToken(accessToken),
                    ExpireInSeconds = (int)_configuration.Expiration.TotalSeconds,
                    UserId = loginResult.User.Id
                };
            }
            catch (Abp.UI.UserFriendlyException)
            {
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
            var roles = await _userManager.GetRolesAsync(user); 
            foreach (var roleName in roles)
            {
                if (!claims.Any(c => c.Type == ClaimTypes.Role && c.Value == roleName))
                {
                    claims.Add(new Claim(ClaimTypes.Role, roleName));
                }
            }

            // Specifically add the jti (random nonce), iat (issued timestamp), and sub (subject/user) claims.
            claims.AddRange(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, nameIdClaim.Value),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.Now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
            });

            return claims;
        }

        private string GetEncryptedAccessToken(string accessToken)
        {
            return SimpleStringCipher.Instance.Encrypt(accessToken);
        }
    }
}
