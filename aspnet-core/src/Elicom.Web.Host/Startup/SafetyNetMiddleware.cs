using Microsoft.AspNetCore.Http;
using System;
using System.Threading.Tasks;

namespace Elicom.Web.Host.Startup
{
    public class SafetyNetMiddleware
    {
        private readonly RequestDelegate _next;

        public SafetyNetMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task Invoke(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                if (context.Response.HasStarted) throw;

                // 🚀 Log to Console for Azure Log Stream
                Console.WriteLine($"[SAFETY-NET] CRITICAL CRASH: {ex.GetType().Name} - {ex.Message}");
                Console.WriteLine(ex.ToString());

                context.Response.StatusCode = 500;
                context.Response.ContentType = "application/json";

                var origin = context.Request.Headers["Origin"].ToString();
                if (!string.IsNullOrEmpty(origin))
                {
                    context.Response.Headers["Access-Control-Allow-Origin"] = origin;
                    context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
                    context.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, X-Requested-With, Authorization, abp-tenantid";
                    context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
                }

                var msg = (ex.Message ?? "Unknown Error").Replace("\"", "'").Replace("\r", " ").Replace("\n", " ");
                var details = (ex.InnerException?.Message ?? ex.ToString()).Replace("\"", "'").Replace("\r", " ").Replace("\n", " ");

                var errorJson = $"{{\"success\":false,\"error\":{{\"message\":\"Critical Server Error (SafetyNet)\",\"details\":\"{msg} | {details}\"}}}}";
                await context.Response.WriteAsync(errorJson);
            }
        }
    }
}
