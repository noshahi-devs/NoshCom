using Abp.Runtime.Security;
using Abp.Domain.Uow;
using Elicom.Authorization.Users;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.Web.Host.Startup
{
    public static class AuthConfigurer
    {
        public static void Configure(IServiceCollection services, IConfiguration configuration)
        {
            var jwtIsEnabled = bool.TryParse(configuration["Authentication:JwtBearer:IsEnabled"], out var enabled) && enabled;
            if (jwtIsEnabled)
            {
                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = "JwtBearer";
                    options.DefaultChallengeScheme = "JwtBearer";
                }).AddJwtBearer("JwtBearer", options =>
                {
                    options.Audience = configuration["Authentication:JwtBearer:Audience"];

                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        // The signing key must match!
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(configuration["Authentication:JwtBearer:SecurityKey"])),

                        // Validate the JWT Issuer (iss) claim
                        ValidateIssuer = true,
                        ValidIssuer = configuration["Authentication:JwtBearer:Issuer"],

                        // Validate the JWT Audience (aud) claim
                        ValidateAudience = true,
                        ValidAudience = configuration["Authentication:JwtBearer:Audience"],

                        // Validate the token expiry
                        ValidateLifetime = true,

                        // If you want to allow a certain amount of clock drift, set that here
                        ClockSkew = TimeSpan.Zero
                    };

                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = QueryStringTokenResolver,
                        OnTokenValidated = ValidateUserStatusAsync
                    };
                });
            }
        }

        /* This method is needed to authorize SignalR javascript client.
         * SignalR can not send authorization header. So, we are getting it from query string as an encrypted text. */
        private static Task QueryStringTokenResolver(MessageReceivedContext context)
        {
            if (!context.HttpContext.Request.Path.HasValue ||
                !context.HttpContext.Request.Path.Value.StartsWith("/signalr"))
            {
                // We are just looking for signalr clients
                return Task.CompletedTask;
            }

            var qsAuthToken = context.HttpContext.Request.Query["enc_auth_token"].FirstOrDefault();
            if (qsAuthToken == null)
            {
                // Cookie value does not matches to querystring value
                return Task.CompletedTask;
            }

            // Set auth token from cookie
            context.Token = SimpleStringCipher.Instance.Decrypt(qsAuthToken);
            return Task.CompletedTask;
        }

        private static async Task ValidateUserStatusAsync(TokenValidatedContext context)
        {
            if (context?.Principal?.Identity?.IsAuthenticated != true)
            {
                return;
            }

            var requestTenantHeader = context.HttpContext?.Request?.Headers?["Abp-TenantId"].ToString();
            var tokenTenantClaim = context.Principal.FindFirst(AbpClaimTypes.TenantId)?.Value;
            if (!string.IsNullOrWhiteSpace(requestTenantHeader) && !string.IsNullOrWhiteSpace(tokenTenantClaim))
            {
                if (int.TryParse(requestTenantHeader, out var headerTenantId) &&
                    int.TryParse(tokenTenantClaim, out var tokenTenantId) &&
                    headerTenantId != tokenTenantId)
                {
                    context.Fail("Tenant mismatch. Please login again from the correct platform.");
                    return;
                }
            }
            else if (!string.IsNullOrWhiteSpace(requestTenantHeader) && string.IsNullOrWhiteSpace(tokenTenantClaim))
            {
                context.Fail("Token is missing tenant context. Please login again.");
                return;
            }

            var userIdClaim = context.Principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                              ?? context.Principal.FindFirst("sub")?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
            {
                context.Fail("Invalid user id claim.");
                return;
            }

            var userManager = context.HttpContext.RequestServices.GetService<UserManager>();
            var unitOfWorkManager = context.HttpContext.RequestServices.GetService<IUnitOfWorkManager>();
            if (userManager == null)
            {
                context.Fail("Unable to validate current user state.");
                return;
            }
            if (unitOfWorkManager == null)
            {
                context.Fail("Unable to validate current user state.");
                return;
            }

            User user;
            using (var uow = unitOfWorkManager.Begin())
            {
                user = await userManager.Users
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(u => u.Id == userId);

                await uow.CompleteAsync();
            }

            if (user == null || user.IsDeleted || !user.IsActive || !user.IsEmailConfirmed)
            {
                context.Fail("User account is disabled or not verified.");
                return;
            }

            // Token revocation check: any DB security-stamp change invalidates existing JWTs.
            const string securityStampClaimType = "AspNet.Identity.SecurityStamp";
            var tokenSecurityStamp = context.Principal.FindFirst(securityStampClaimType)?.Value;

            if (string.IsNullOrWhiteSpace(tokenSecurityStamp) ||
                string.IsNullOrWhiteSpace(user.SecurityStamp) ||
                !string.Equals(tokenSecurityStamp, user.SecurityStamp, StringComparison.Ordinal))
            {
                context.Fail("Token has been revoked. Please login again.");
            }
        }
    }
}
