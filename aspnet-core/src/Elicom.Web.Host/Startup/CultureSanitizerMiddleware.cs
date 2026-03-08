using Microsoft.AspNetCore.Http;
using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Web.Host.Startup
{
    /// <summary>
    /// Runs BEFORE ABP localization to sanitize any invalid culture values from
    /// Accept-Language headers, ABP culture headers, and ABP culture cookies.
    /// Prevents System.Globalization.CultureNotFoundException at the framework level.
    /// </summary>
    public class CultureSanitizerMiddleware
    {
        private readonly RequestDelegate _next;
        private const string FallbackCulture = "en";

        public CultureSanitizerMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task Invoke(HttpContext context)
        {
            try
            {
                // 1. Scan ALL headers for binary garbage
                foreach (var header in context.Request.Headers.Keys.ToList())
                {
                    var values = context.Request.Headers[header];
                    var sanitized = values.Select(v => IsStringCorrupted(v) ? "" : v).ToArray();
                    if (!values.SequenceEqual(sanitized))
                        context.Request.Headers[header] = sanitized;
                }

                // 2. Sanitize Accept-Language header
                SanitizeAcceptLanguageHeader(context);

                // 3. Sanitize ABP culture header (direct culture name, e.g. "en" or "en-US")
                SanitizeAbpCultureHeader(context);

                // 4. Sanitize the ABP culture cookie (.AspNetCore.Culture format: "c=en|uic=en")
                SanitizeAbpCultureCookie(context);
            }
            catch (Exception)
            {
                // Never let the sanitizer itself crash the pipeline
            }

            try
            {
                await _next(context);
            }
            catch (CultureNotFoundException)
            {
                // Last resort: if a CultureNotFoundException slipped through (e.g. from DB)
                // return a generic JSON error instead of a 500 crash
                if (!context.Response.HasStarted)
                {
                    context.Response.StatusCode = 200; // ABP expects 200 on API errors
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync(
                        "{\"success\":false,\"error\":{\"code\":0,\"message\":\"A server culture configuration error occurred. Please contact support.\",\"details\":null}}");
                }
            }
        }

        // ─── Accept-Language ─────────────────────────────────────────────────────
        private void SanitizeAcceptLanguageHeader(HttpContext context)
        {
            if (!context.Request.Headers.TryGetValue("Accept-Language", out var values))
                return;

            var sanitized = values.Select(v =>
            {
                if (string.IsNullOrWhiteSpace(v)) return FallbackCulture;
                // Accept-Language is comma-separated, each part optionally has ;q= weight
                var validParts = v.Split(',')
                    .Select(part => part.Trim())
                    .Where(part => !string.IsNullOrEmpty(part))
                    .Where(part =>
                    {
                        // Strip quality weight: "en-US;q=0.9" → "en-US"
                        var culturePart = part.Split(';')[0].Trim();
                        return culturePart == "*" || IsValidCulture(culturePart);
                    });

                var result = string.Join(", ", validParts);
                return string.IsNullOrEmpty(result) ? FallbackCulture : result;
            }).ToArray();

            context.Request.Headers["Accept-Language"] = sanitized;
        }

        // ─── ABP Culture Header ───────────────────────────────────────────────────
        private void SanitizeAbpCultureHeader(HttpContext context)
        {
            const string header = "Abp.Localization.CultureName";
            if (!context.Request.Headers.TryGetValue(header, out var values))
                return;

            var sanitized = values
                .Select(v => IsValidCulture(v?.Trim()) ? v.Trim() : FallbackCulture)
                .ToArray();

            context.Request.Headers[header] = sanitized;
        }

        // ─── ABP Culture Cookie ───────────────────────────────────────────────────
        /// <summary>
        /// ABP stores culture in cookie as: "c=en-US|uic=en-US"
        /// We validate each side of the pipe separately.
        /// </summary>
        private void SanitizeAbpCultureCookie(HttpContext context)
        {
            const string cookieName = ".AspNetCore.Culture";

            if (!context.Request.Cookies.TryGetValue(cookieName, out var cookieValue))
                return;

            if (IsStringCorrupted(cookieValue))
            {
                DeleteCultureCookies(context);
                return;
            }

            // Parse "c=en-US|uic=en-US" format
            try
            {
                var parts = cookieValue.Split('|');
                bool allValid = parts.All(part =>
                {
                    // each part is like "c=en-US" or "uic=en-US"
                    var eqIdx = part.IndexOf('=');
                    if (eqIdx < 0) return false;
                    var cultureName = part.Substring(eqIdx + 1).Trim();
                    return IsValidCulture(cultureName);
                });

                if (!allValid)
                    DeleteCultureCookies(context);
            }
            catch
            {
                DeleteCultureCookies(context);
            }
        }

        private static void DeleteCultureCookies(HttpContext context)
        {
            context.Response.Cookies.Delete(".AspNetCore.Culture");
            context.Response.Cookies.Delete("Abp.Localization.CultureName");
        }

        // ─── Helpers ──────────────────────────────────────────────────────────────
        private static bool IsValidCulture(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return false;
            if (name.Length > 20) return false;        // No valid culture is longer than this
            if (name == "*") return true;              // Wildcard is valid in Accept-Language

            try
            {
                CultureInfo.GetCultureInfo(name);
                return true;
            }
            catch (CultureNotFoundException)
            {
                return false;
            }
        }

        private static bool IsStringCorrupted(string v)
        {
            if (string.IsNullOrEmpty(v)) return false;

            // Check for non-printable or high-ASCII chars (binary data leakage)
            if (v.Any(c => c < 32 && c != '\t' && c != '\r' && c != '\n')) return true;
            if (v.Any(c => c > 126)) return true;

            // Check for ASP.NET compiler noise leaking into headers
            if (v.Contains("d__") || v.Contains("MoveNext")) return true;

            return false;
        }
    }
}
