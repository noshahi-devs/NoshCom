using Abp.AspNetCore;
using Abp.AspNetCore.Mvc.Antiforgery;
using Abp.AspNetCore.SignalR.Hubs;
using Abp.Castle.Logging.Log4Net;
using Abp.Extensions;
using Elicom.Configuration;
using Elicom.Identity;
using Castle.Facilities.Logging;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.OpenApi.Models;
using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.RateLimiting;


namespace Elicom.Web.Host.Startup
{
    public class Startup
    {
        private const string _defaultCorsPolicyName = "localhost";
        private const string _swaggerAuthCookieName = "elicom_swagger_auth";

        private const string _apiVersion = "v1";

        private readonly IConfigurationRoot _appConfiguration;
        private readonly IWebHostEnvironment _hostingEnvironment;

        public Startup(IWebHostEnvironment env)
        {
            _hostingEnvironment = env;
            _appConfiguration = env.GetAppConfiguration();
        }

        public void ConfigureServices(IServiceCollection services)
        {
            //MVC
            services.AddControllersWithViews(options =>
            {
                options.Filters.Add(new AbpAutoValidateAntiforgeryTokenAttribute());
            });

            IdentityRegistrar.Register(services);
            AuthConfigurer.Configure(services, _appConfiguration);

            services.AddSignalR();
            ConfigureRateLimiter(services);

            services.AddCors(
                options => options.AddPolicy(
                    _defaultCorsPolicyName,
                    builder =>
                    {
                        var corsOrigins = _appConfiguration["App:CorsOrigins"];
                        var origins = (corsOrigins ?? "")
                            .Split(",", StringSplitOptions.RemoveEmptyEntries)
                            .Select(o => o.RemovePostFix("/"))
                            .ToArray();

                        if (origins.Contains("*") || string.IsNullOrEmpty(corsOrigins))
                        {
                            builder.SetIsOriginAllowed(_ => true);
                        }
                        else
                        {
                            builder.WithOrigins(origins);
                        }

                        builder.AllowAnyHeader()
                            .AllowAnyMethod()
                            .AllowCredentials()
                            .WithExposedHeaders("Date");
                    }
                )
            );

            // Swagger - Enable this line and the related lines in Configure method to enable swagger UI
            ConfigureSwagger(services);

            // ── Safe Culture Fallback ────────────────────────────────────────────
            // Prevents CultureNotFoundException when ABP/DB supplies an unsupported
            // culture name. We explicitly list accepted cultures; anything else
            // falls back to 'en' before reaching ABP localization.
            var supportedCultures = new[]
            {
                new CultureInfo("en"),
                new CultureInfo("en-US"),
                new CultureInfo("en-GB"),
                new CultureInfo("ar"),
                new CultureInfo("ar-SA"),
                new CultureInfo("fr"),
                new CultureInfo("fr-FR"),
                new CultureInfo("de"),
                new CultureInfo("de-DE"),
                new CultureInfo("tr"),
                new CultureInfo("tr-TR"),
                new CultureInfo("zh"),
                new CultureInfo("zh-CN"),
                new CultureInfo("ur"),
                new CultureInfo("hi"),
            };

            services.Configure<RequestLocalizationOptions>(opts =>
            {
                opts.DefaultRequestCulture = new RequestCulture("en");
                opts.SupportedCultures = supportedCultures;
                opts.SupportedUICultures = supportedCultures;
                // Fall back to 'en' instead of crashing on unrecognized cultures
                opts.FallBackToParentCultures = true;
                opts.FallBackToParentUICultures = true;
            });

            // Configure Abp and Dependency Injection
            services.AddAbpWithoutCreatingServiceProvider<ElicomWebHostModule>(
                // Configure Log4Net logging
                options => options.IocManager.IocContainer.AddFacility<LoggingFacility>(
                    f => f.UseAbpLog4Net().WithConfig(_hostingEnvironment.IsDevelopment()
                        ? "log4net.config"
                        : "log4net.Production.config"
                    )
                )
            );
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env, ILoggerFactory loggerFactory)
        {
            System.Net.ServicePointManager.ServerCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true;

            app.Use(async (context, next) =>
            {
                context.Response.Headers["X-Content-Type-Options"] = "nosniff";
                context.Response.Headers["X-Frame-Options"] = "DENY";
                context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
                context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
                // Allow cross-origin embedding for uploaded media (e.g. admin UI hosted on a sibling domain).
                var isUploadsRequest = context.Request.Path.StartsWithSegments("/uploads", StringComparison.OrdinalIgnoreCase);
                context.Response.Headers["Cross-Origin-Resource-Policy"] = isUploadsRequest ? "cross-origin" : "same-origin";

                if (!context.Request.Path.StartsWithSegments("/swagger", StringComparison.OrdinalIgnoreCase))
                {
                    context.Response.Headers["Content-Security-Policy"] =
                        "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'";
                }

                await next();
            });

            // 0. ULTIMATE SAFETY NET: Ensure CORS headers & JSON Error on Crash
            app.UseMiddleware<SafetyNetMiddleware>();

            // 1. ULTIMATE CULTURE SANITIZER: Prevent CultureNotFoundException for mangled headers
            app.UseMiddleware<CultureSanitizerMiddleware>();

            // 2. CORS must be early to handle OPTIONS requests (preflight) immediately
            app.UseCors(_defaultCorsPolicyName);

            // 3. Initialize ABP
            app.UseAbp(options => { options.UseAbpRequestLocalization = false; }); 

            app.UseStaticFiles();
            ConfigureUploadsStaticFiles(app);

            app.UseRouting();
            app.UseRateLimiter();

            app.UseAuthentication();
            app.UseAuthorization();

            app.UseAbpRequestLocalization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapHub<AbpCommonHub>("/signalr");
                endpoints.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
                endpoints.MapControllerRoute("defaultWithArea", "{area}/{controller=Home}/{action=Index}/{id?}");
            });

            if (!env.IsProduction())
            {
                var swaggerBasicAuthEnabled = _appConfiguration.GetValue<bool?>("Swagger:BasicAuth:Enabled") ?? true;
                if (swaggerBasicAuthEnabled)
                {
                    UseSwaggerBasicAuth(app);
                }

                // Enable middleware to serve generated Swagger as a JSON endpoint
                app.UseSwagger(c => { c.RouteTemplate = "swagger/{documentName}/swagger.json"; });

                // Enable middleware to serve swagger-ui assets (HTML, JS, CSS etc.)
                app.UseSwaggerUI(options =>
                {
                    // specifying the Swagger JSON endpoint.
                    options.SwaggerEndpoint($"/swagger/{_apiVersion}/swagger.json", $"Elicom API {_apiVersion}");
                    options.IndexStream = () => Assembly.GetExecutingAssembly()
                        .GetManifestResourceStream("Elicom.Web.Host.wwwroot.swagger.ui.index.html");
                    options.DisplayRequestDuration(); // Controls the display of the request duration (in milliseconds) for "Try it out" requests.
                }); // URL: /swagger
            }

            // 🚀 IMPORTANT: EF Core Retry strategy has been removed from ElicomDbContextConfigurer to prevent transaction conflicts.
        }

        private void UseSwaggerBasicAuth(IApplicationBuilder app)
        {
            var swaggerUser = FirstNonEmpty(
                Environment.GetEnvironmentVariable("ELICOM_SWAGGER_BASIC_AUTH_USERNAME"),
                _appConfiguration["Swagger:BasicAuth:Username"]);
            var swaggerPass = FirstNonEmpty(
                Environment.GetEnvironmentVariable("ELICOM_SWAGGER_BASIC_AUTH_PASSWORD"),
                _appConfiguration["Swagger:BasicAuth:Password"]);

            app.Use(async (context, next) =>
            {
                if (!context.Request.Path.StartsWithSegments("/swagger", StringComparison.OrdinalIgnoreCase))
                {
                    await next();
                    return;
                }

                if (context.Request.Cookies.TryGetValue(_swaggerAuthCookieName, out var swaggerCookie) &&
                    string.Equals(swaggerCookie, "1", StringComparison.Ordinal))
                {
                    await next();
                    return;
                }

                if (string.IsNullOrWhiteSpace(swaggerUser) || string.IsNullOrWhiteSpace(swaggerPass))
                {
                    ChallengeSwaggerAuth(context);
                    return;
                }

                if (!context.Request.Headers.TryGetValue("Authorization", out var authHeader))
                {
                    ChallengeSwaggerAuth(context);
                    return;
                }

                var header = authHeader.ToString();
                if (!header.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
                {
                    ChallengeSwaggerAuth(context);
                    return;
                }

                string decoded;
                try
                {
                    var encoded = header.Substring("Basic ".Length).Trim();
                    decoded = Encoding.UTF8.GetString(Convert.FromBase64String(encoded));
                }
                catch
                {
                    ChallengeSwaggerAuth(context);
                    return;
                }

                var parts = decoded.Split(':', 2);
                if (parts.Length != 2)
                {
                    ChallengeSwaggerAuth(context);
                    return;
                }

                var valid = string.Equals(parts[0], swaggerUser, StringComparison.Ordinal) &&
                            string.Equals(parts[1], swaggerPass, StringComparison.Ordinal);

                if (!valid)
                {
                    ChallengeSwaggerAuth(context);
                    return;
                }

                context.Response.Cookies.Append(
                    _swaggerAuthCookieName,
                    "1",
                    new CookieOptions
                    {
                        HttpOnly = true,
                        IsEssential = true,
                        Secure = context.Request.IsHttps,
                        SameSite = SameSiteMode.Lax,
                        Expires = DateTimeOffset.UtcNow.AddMinutes(30)
                    });

                await next();
            });
        }

        private static void ChallengeSwaggerAuth(HttpContext context)
        {
            context.Response.Headers["WWW-Authenticate"] = "Basic realm=\"Swagger\"";
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
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

        private void ConfigureUploadsStaticFiles(IApplicationBuilder app)
        {
            var uploadsRootPath = _appConfiguration["FileStorage:LocalRootPath"];
            if (string.IsNullOrWhiteSpace(uploadsRootPath))
            {
                uploadsRootPath = @"C:\data\uploads";
            }

            var requestPath = _appConfiguration["FileStorage:RequestPath"];
            if (string.IsNullOrWhiteSpace(requestPath))
            {
                requestPath = "/uploads";
            }

            requestPath = "/" + requestPath.Trim().Trim('/');

            Directory.CreateDirectory(uploadsRootPath);

            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new PhysicalFileProvider(uploadsRootPath),
                RequestPath = requestPath
            });
        }

        private void ConfigureSwagger(IServiceCollection services)
        {
            services.AddSwaggerGen(options =>
            {
                options.SwaggerDoc(_apiVersion, new OpenApiInfo
                {
                    Version = _apiVersion,
                    Title = "Elicom API",
                    Description = "Elicom",
                    // uncomment if needed TermsOfService = new Uri("https://example.com/terms"),
                    Contact = new OpenApiContact
                    {
                        Name = "Elicom",
                        Email = string.Empty,
                        Url = new Uri("https://twitter.com/aspboilerplate"),
                    },
                    License = new OpenApiLicense
                    {
                        Name = "MIT License",
                        Url = new Uri("https://github.com/aspnetboilerplate/aspnetboilerplate/blob/dev/LICENSE.md"),
                    }
                });
                options.DocInclusionPredicate((docName, description) => true);

                // Define the BearerAuth scheme that's in use
                options.AddSecurityDefinition("bearerAuth", new OpenApiSecurityScheme()
                {
                    Description =
                        "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
                    Name = "Authorization",
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.ApiKey
                });

                //add summaries to swagger
                bool canShowSummaries = _appConfiguration.GetValue<bool>("Swagger:ShowSummaries");
                if (canShowSummaries)
                {
                    var hostXmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
                    var hostXmlPath = Path.Combine(AppContext.BaseDirectory, hostXmlFile);
                    options.IncludeXmlComments(hostXmlPath);

                    var applicationXml = $"Elicom.Application.xml";
                    var applicationXmlPath = Path.Combine(AppContext.BaseDirectory, applicationXml);
                    options.IncludeXmlComments(applicationXmlPath);

                    var webCoreXmlFile = $"Elicom.Web.Core.xml";
                    var webCoreXmlPath = Path.Combine(AppContext.BaseDirectory, webCoreXmlFile);
                    options.IncludeXmlComments(webCoreXmlPath);
                }
            });
        }

        private static void ConfigureRateLimiter(IServiceCollection services)
        {
            services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

                options.OnRejected = async (context, token) =>
                {
                    context.HttpContext.Response.ContentType = "application/json";
                    await context.HttpContext.Response.WriteAsync(
                        "{\"error\":\"Too many requests. Please wait and try again.\"}",
                        token);
                };

                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                {
                    var path = httpContext.Request.Path.Value ?? string.Empty;
                    var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                    if (HttpMethods.IsOptions(httpContext.Request.Method))
                    {
                        return RateLimitPartition.GetFixedWindowLimiter(
                            $"preflight:{ip}",
                            _ => new FixedWindowRateLimiterOptions
                            {
                                PermitLimit = 240,
                                Window = TimeSpan.FromMinutes(1),
                                QueueLimit = 0,
                                AutoReplenishment = true
                            });
                    }

                    if (path.Contains("/TokenAuth/Authenticate", StringComparison.OrdinalIgnoreCase) ||
                        path.Contains("/TokenAuth/VerifyLoginOtp", StringComparison.OrdinalIgnoreCase) ||
                        path.Contains("/TokenAuth/ResendLoginOtp", StringComparison.OrdinalIgnoreCase))
                    {
                        return RateLimitPartition.GetFixedWindowLimiter(
                            $"auth:{ip}",
                            _ => new FixedWindowRateLimiterOptions
                            {
                                PermitLimit = 10,
                                Window = TimeSpan.FromMinutes(1),
                                QueueLimit = 0,
                                AutoReplenishment = true
                            });
                    }

                    return RateLimitPartition.GetFixedWindowLimiter(
                        $"api:{ip}",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 120,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                            AutoReplenishment = true
                        });
                });
            });
        }
    }
}
