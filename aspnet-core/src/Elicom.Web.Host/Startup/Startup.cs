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


namespace Elicom.Web.Host.Startup
{
    public class Startup
    {
        private const string _defaultCorsPolicyName = "localhost";

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
                            .AllowCredentials();
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

            app.UseAuthentication();
            app.UseAuthorization();

            app.UseAbpRequestLocalization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapHub<AbpCommonHub>("/signalr");
                endpoints.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
                endpoints.MapControllerRoute("defaultWithArea", "{area}/{controller=Home}/{action=Index}/{id?}");
            });

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

            // 🚀 IMPORTANT: EF Core Retry strategy has been removed from ElicomDbContextConfigurer to prevent transaction conflicts.
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
    }
}
