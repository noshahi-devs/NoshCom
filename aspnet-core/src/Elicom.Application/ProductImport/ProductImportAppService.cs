using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Abp.UI;
using HtmlAgilityPack;
using Microsoft.Extensions.Configuration;
using Microsoft.Playwright;

namespace Elicom.ProductImport
{
    public class ProductImportAppService : ElicomAppServiceBase, IProductImportAppService
    {
        private const int MaxHtmlBytes = 2_000_000; // 2MB safety cap
        private const int DefaultPlaywrightTimeoutSeconds = 25;
        private readonly IConfiguration _configuration;

        public ProductImportAppService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<ProductImportResultDto> FetchProductByUrl(ProductImportRequestDto input)
        {
            if (input == null || string.IsNullOrWhiteSpace(input.Url))
            {
                throw new UserFriendlyException("Product URL is required.");
            }

            if (!TryValidateUrl(input.Url, out var uri, out var error))
            {
                throw new UserFriendlyException(error ?? "Invalid URL.");
            }

            var html = await FetchHtmlAsync(uri);
            if (string.IsNullOrWhiteSpace(html))
            {
                throw new UserFriendlyException("Failed to fetch product data from the URL.");
            }

            var isAmazon = IsAmazonHost(uri.Host);
            var blocked = isAmazon && LooksLikeAmazonBlockedPage(html);

            ProductImportResultDto result = null;
            if (!blocked)
            {
                result = ParseProductFromHtml(html, uri);
            }

            if (isAmazon && (blocked || IsEmptyResult(result)))
            {
                if (GetScrapingEnabled())
                {
                    Logger?.Warn($"ProductImport: Amazon fallback via scraping service for {uri} (blocked={blocked}, empty={IsEmptyResult(result)}).");
                    var serviceHtml = await TryFetchHtmlViaScrapingServiceAsync(uri);
                    if (!string.IsNullOrWhiteSpace(serviceHtml))
                    {
                        html = serviceHtml;
                        blocked = LooksLikeAmazonBlockedPage(html);
                        result = ParseProductFromHtml(html, uri);
                    }
                    else
                    {
                        Logger?.Warn($"ProductImport: Scraping service returned empty HTML for {uri}.");
                    }
                }

                var playwrightEnabled = GetPlaywrightEnabled();
                if (playwrightEnabled)
                {
                    Logger?.Warn($"ProductImport: Amazon fallback via Playwright for {uri} (blocked={blocked}, empty={IsEmptyResult(result)}).");
                    var playwrightHtml = await TryFetchHtmlWithPlaywrightAsync(uri);
                    if (!string.IsNullOrWhiteSpace(playwrightHtml))
                    {
                        html = playwrightHtml;
                        blocked = LooksLikeAmazonBlockedPage(html);
                        result = ParseProductFromHtml(html, uri);
                    }
                    else
                    {
                        Logger?.Warn($"ProductImport: Playwright returned empty HTML for {uri}.");
                    }
                }
                else
                {
                    Logger?.Warn($"ProductImport: Playwright fallback disabled for {uri}.");
                }
            }

            if (isAmazon && blocked)
            {
                throw new UserFriendlyException("Amazon is blocking automated access (Robot Check/CAPTCHA). Please try again later or use a different source URL.");
            }

            result ??= ParseProductFromHtml(html, uri);
            if (IsEmptyResult(result))
            {
                result.Warning = isAmazon && LooksLikeAmazonBlockedPage(html)
                    ? "Amazon appears to be blocking automated access (Robot Check/CAPTCHA). Please try again later or use a different source URL."
                    : "Could not detect full product details. You can still edit manually.";
            }

            return result;
        }

        private static bool TryValidateUrl(string url, out Uri uri, out string error)
        {
            error = null;
            if (string.IsNullOrWhiteSpace(url))
            {
                error = "Invalid URL format.";
                uri = null;
                return false;
            }

            var normalized = NormalizeInputUrl(url);
            if (normalized.StartsWith("//"))
            {
                normalized = $"https:{normalized}";
            }
            else if (!normalized.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                     !normalized.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                normalized = $"https://{normalized}";
            }

            if (!Uri.TryCreate(normalized, UriKind.Absolute, out uri))
            {
                var escaped = Uri.EscapeUriString(normalized);
                if (!Uri.TryCreate(escaped, UriKind.Absolute, out uri))
                {
                    error = "Invalid URL format.";
                    return false;
                }
            }

            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            {
                error = "Only http/https URLs are supported.";
                return false;
            }

            if (IsPrivateHost(uri.Host))
            {
                error = "Private or local URLs are not allowed.";
                return false;
            }

            return true;
        }

        private static string NormalizeInputUrl(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return input;

            var trimmed = input.Trim().Trim('\'', '"');

            // If a full URL exists inside the string, extract it.
            var httpsIndex = trimmed.IndexOf("http://", StringComparison.OrdinalIgnoreCase);
            var httpssIndex = trimmed.IndexOf("https://", StringComparison.OrdinalIgnoreCase);
            var startIndex = -1;
            if (httpsIndex >= 0 && httpssIndex >= 0) startIndex = Math.Min(httpsIndex, httpssIndex);
            else startIndex = Math.Max(httpsIndex, httpssIndex);

            if (startIndex >= 0)
            {
                trimmed = trimmed.Substring(startIndex);
            }

            // If it starts with www. or domain only, keep until first whitespace
            var whitespaceIndex = trimmed.IndexOfAny(new[] { ' ', '\n', '\r', '\t' });
            if (whitespaceIndex > 0)
            {
                trimmed = trimmed.Substring(0, whitespaceIndex);
            }

            return trimmed.Trim().TrimEnd('.', ',', ';');
        }

        private static bool IsPrivateHost(string host)
        {
            var lowered = host.ToLowerInvariant();
            if (lowered == "localhost" || lowered == "127.0.0.1") return true;

            if (IPAddress.TryParse(host, out var ip))
            {
                var bytes = ip.GetAddressBytes();
                return bytes[0] == 10 ||
                       (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) ||
                       (bytes[0] == 192 && bytes[1] == 168);
            }

            return false;
        }

        private bool GetPlaywrightEnabled()
        {
            return _configuration?.GetValue<bool>("ProductImport:UsePlaywrightForAmazon") ?? false;
        }

        private bool GetScrapingEnabled()
        {
            return _configuration?.GetValue<bool>("ProductImport:Scraping:Enabled") ?? false;
        }

        private string GetScrapingProvider()
        {
            return _configuration?["ProductImport:Scraping:Provider"];
        }

        private string GetScrapingApiKey()
        {
            return _configuration?["ProductImport:Scraping:ApiKey"];
        }

        private bool GetScrapingRender()
        {
            return _configuration?.GetValue<bool>("ProductImport:Scraping:Render") ?? true;
        }

        private int GetScrapingTimeoutSeconds()
        {
            var timeout = _configuration?.GetValue<int?>("ProductImport:Scraping:TimeoutSeconds");
            if (timeout.HasValue && timeout.Value > 0) return timeout.Value;
            return 30;
        }

        private int GetPlaywrightTimeoutSeconds()
        {
            var timeout = _configuration?.GetValue<int?>("ProductImport:PlaywrightTimeoutSeconds");
            if (timeout.HasValue && timeout.Value > 0) return timeout.Value;
            return DefaultPlaywrightTimeoutSeconds;
        }

        private string GetPlaywrightProxy()
        {
            return _configuration?["ProductImport:PlaywrightProxy"];
        }

        private static async Task<string> FetchHtmlAsync(Uri uri)
        {
            using var handler = new HttpClientHandler
            {
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
            };

            using var client = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromSeconds(15)
            };

            client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36");
            client.DefaultRequestHeaders.TryAddWithoutValidation("Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            client.DefaultRequestHeaders.TryAddWithoutValidation("Accept-Language", "en-US,en;q=0.9");

            HttpResponseMessage response;
            try
            {
                response = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
            }
            catch (HttpRequestException ex)
            {
                throw new UserFriendlyException($"Failed to fetch product page. {ex.Message}");
            }

            if (!response.IsSuccessStatusCode)
            {
                throw new UserFriendlyException($"Failed to fetch product page (HTTP {(int)response.StatusCode}). The site may be blocking automated requests.");
            }

            await using var stream = await response.Content.ReadAsStreamAsync();
            using var ms = new MemoryStream();
            var buffer = new byte[8192];
            int read;
            int total = 0;
            while ((read = await stream.ReadAsync(buffer, 0, buffer.Length)) > 0)
            {
                total += read;
                if (total > MaxHtmlBytes) break;
                ms.Write(buffer, 0, read);
            }

            return System.Text.Encoding.UTF8.GetString(ms.ToArray());
        }

        private async Task<string> TryFetchHtmlViaScrapingServiceAsync(Uri uri)
        {
            var provider = GetScrapingProvider();
            var apiKey = GetScrapingApiKey();
            if (string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(apiKey))
            {
                Logger?.Warn("ProductImport: Scraping service is enabled but Provider/ApiKey is missing.");
                return null;
            }

            var targetUrl = uri.ToString();
            var timeoutSeconds = GetScrapingTimeoutSeconds();
            var render = GetScrapingRender();
            var requestUrl = BuildScrapingUrl(provider, apiKey, targetUrl, render);
            if (string.IsNullOrWhiteSpace(requestUrl))
            {
                Logger?.Warn($"ProductImport: Unsupported scraping provider '{provider}'.");
                return null;
            }

            try
            {
                using var handler = new HttpClientHandler
                {
                    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
                };

                using var client = new HttpClient(handler)
                {
                    Timeout = TimeSpan.FromSeconds(timeoutSeconds)
                };

                client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36");

                var response = await client.GetAsync(requestUrl, HttpCompletionOption.ResponseHeadersRead);
                if (!response.IsSuccessStatusCode)
                {
                    Logger?.Warn($"ProductImport: Scraping service HTTP {(int)response.StatusCode} for {uri}.");
                    return null;
                }

                await using var stream = await response.Content.ReadAsStreamAsync();
                using var ms = new MemoryStream();
                var buffer = new byte[8192];
                int read;
                int total = 0;
                while ((read = await stream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    total += read;
                    if (total > MaxHtmlBytes) break;
                    ms.Write(buffer, 0, read);
                }

                return System.Text.Encoding.UTF8.GetString(ms.ToArray());
            }
            catch (Exception ex)
            {
                Logger?.Warn($"ProductImport: Scraping service failed for {uri}. {ex.Message}");
                return null;
            }
        }

        private static string BuildScrapingUrl(string provider, string apiKey, string targetUrl, bool render)
        {
            if (string.IsNullOrWhiteSpace(provider)) return null;

            var lower = provider.Trim().ToLowerInvariant();
            var encodedUrl = Uri.EscapeDataString(targetUrl);
            if (lower == "scraperapi")
            {
                var renderParam = render ? "&render=true" : string.Empty;
                return $"https://api.scraperapi.com?api_key={Uri.EscapeDataString(apiKey)}&url={encodedUrl}{renderParam}";
            }

            if (lower == "zenrows")
            {
                var renderParam = render ? "&js_render=true" : string.Empty;
                return $"https://api.zenrows.com/v1/?apikey={Uri.EscapeDataString(apiKey)}&url={encodedUrl}{renderParam}";
            }

            return null;
        }

        private async Task<string> TryFetchHtmlWithPlaywrightAsync(Uri uri)
        {
            IPlaywright playwright = null;
            IBrowser browser = null;
            IBrowserContext context = null;
            try
            {
                var timeoutMs = GetPlaywrightTimeoutSeconds() * 1000;
                playwright = await Playwright.CreateAsync();
                var launchOptions = new BrowserTypeLaunchOptions
                {
                    Headless = true,
                    Timeout = timeoutMs
                };

                var proxy = GetPlaywrightProxy();
                if (!string.IsNullOrWhiteSpace(proxy))
                {
                    launchOptions.Proxy = new Proxy { Server = proxy };
                }

                browser = await playwright.Chromium.LaunchAsync(launchOptions);
                context = await browser.NewContextAsync(new BrowserNewContextOptions
                {
                    UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
                    Locale = "en-US",
                    ExtraHTTPHeaders = new Dictionary<string, string>
                    {
                        ["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        ["Accept-Language"] = "en-US,en;q=0.9"
                    }
                });

                var page = await context.NewPageAsync();
                await page.RouteAsync("**/*", route =>
                {
                    var type = route.Request.ResourceType;
                    if (type == "image" || type == "font" || type == "media")
                    {
                        return route.AbortAsync();
                    }

                    return route.ContinueAsync();
                });

                await page.GotoAsync(uri.ToString(), new PageGotoOptions
                {
                    WaitUntil = WaitUntilState.DOMContentLoaded,
                    Timeout = timeoutMs
                });

                try
                {
                    await page.WaitForSelectorAsync("#productTitle", new PageWaitForSelectorOptions
                    {
                        Timeout = Math.Min(timeoutMs, 15000)
                    });
                }
                catch
                {
                    // ignore if selector never appears
                }

                var content = await page.ContentAsync();
                return content;
            }
            catch (Exception ex)
            {
                Logger?.Warn($"ProductImport: Playwright failed for {uri}. {ex.Message}");
                return null;
            }
            finally
            {
                if (context != null)
                {
                    try { await context.CloseAsync(); } catch { }
                }

                if (browser != null)
                {
                    try { await browser.CloseAsync(); } catch { }
                }

                if (playwright != null)
                {
                    if (playwright is IAsyncDisposable asyncDisposable)
                    {
                        try { await asyncDisposable.DisposeAsync(); } catch { }
                    }
                    else if (playwright is IDisposable disposable)
                    {
                        try { disposable.Dispose(); } catch { }
                    }
                }
            }
        }

        private static ProductImportResultDto ParseProductFromHtml(string html, Uri uri)
        {
            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            var result = new ProductImportResultDto
            {
                SourceUrl = uri.ToString()
            };

            // JSON-LD first (most reliable)
            TryParseJsonLd(doc, result);

            // Meta tags fallback
            result.Name ??= GetMetaContent(doc, "og:title") ?? GetTitle(doc);
            result.Description ??= GetMetaContent(doc, "og:description") ?? GetMetaContent(doc, "description");

            if (IsAmazonHost(uri.Host) && string.IsNullOrWhiteSpace(result.Name))
            {
                result.Name = TryExtractAmazonTitle(doc);
            }

            if (string.IsNullOrWhiteSpace(result.Brand))
            {
                result.Brand = TryParseBrand(doc, uri);
            }

            if (result.Images.Count == 0)
            {
                var ogImage = GetMetaContent(doc, "og:image");
                if (!string.IsNullOrWhiteSpace(ogImage))
                {
                    result.Images.Add(ogImage);
                }
            }

            if (result.Images.Count == 0 && IsAmazonHost(uri.Host))
            {
                TryAppendAmazonImages(doc, result);
            }

            if (!result.Price.HasValue)
            {
                var priceRaw = GetMetaContent(doc, "product:price:amount") ?? GetMetaContent(doc, "price");
                result.Price = TryParseDecimal(priceRaw);
            }

            if (string.IsNullOrWhiteSpace(result.Currency))
            {
                result.Currency = GetMetaContent(doc, "product:price:currency");
            }

            if (IsAmazonHost(uri.Host))
            {
                ApplyAmazonOverrides(doc, result);
            }

            result.Name = CleanProductName(result.Name, uri);
            result.Description = ReplaceAmazonBranding(result.Description, uri);
            result.Images = result.Images
                .Where(i => !string.IsNullOrWhiteSpace(i))
                .Select(i => i.Trim())
                .Where(i => !IsAmazonVideoUrl(i))
                .Select(i => IsAmazonHost(uri.Host) ? NormalizeAmazonImageUrl(i) : i)
                .Distinct()
                .ToList();

            return result;
        }

        private static bool IsEmptyResult(ProductImportResultDto result)
        {
            return result == null ||
                   (string.IsNullOrWhiteSpace(result.Name) &&
                    string.IsNullOrWhiteSpace(result.Description) &&
                    result.Images.Count == 0);
        }

        private static string CleanProductName(string name, Uri uri)
        {
            if (string.IsNullOrWhiteSpace(name)) return name;
            var cleaned = name.Trim();

            if (IsAmazonHost(uri.Host))
            {
                if (cleaned.StartsWith("Amazon.com:", StringComparison.OrdinalIgnoreCase))
                {
                    cleaned = cleaned.Substring("Amazon.com:".Length).Trim();
                }

                var suffixIndex = cleaned.LastIndexOf(" : ", StringComparison.Ordinal);
                if (suffixIndex > 0)
                {
                    var suffix = cleaned.Substring(suffixIndex + 3);
                    if (!string.IsNullOrWhiteSpace(suffix) && suffix.Length <= 30)
                    {
                        cleaned = cleaned.Substring(0, suffixIndex).Trim();
                    }
                }
            }

            return cleaned;
        }

        private static bool IsAmazonHost(string host)
        {
            if (string.IsNullOrWhiteSpace(host)) return false;
            var lowered = host.ToLowerInvariant();
            return lowered.Contains("amazon.");
        }

        private static string TryParseBrand(HtmlDocument doc, Uri uri)
        {
            // JSON-LD is handled earlier; this is extra fallback
            var metaBrand = GetMetaContent(doc, "product:brand") ?? GetMetaContent(doc, "brand");
            if (!string.IsNullOrWhiteSpace(metaBrand))
            {
                return metaBrand.Trim();
            }

            if (IsAmazonHost(uri.Host))
            {
                var byline = doc.DocumentNode.SelectSingleNode("//*[@id='bylineInfo']")?.InnerText?.Trim();
                if (!string.IsNullOrWhiteSpace(byline))
                {
                    var brand = ExtractAmazonBrandFromByline(byline);
                    if (!string.IsNullOrWhiteSpace(brand)) return brand;
                }

                // detail bullets: Brand
                var brandNode = doc.DocumentNode.SelectSingleNode("//div[@id='detailBullets_feature_div']//span[contains(text(),'Brand')]/following-sibling::span");
                if (brandNode != null)
                {
                    var brand = brandNode.InnerText?.Trim();
                    if (!string.IsNullOrWhiteSpace(brand)) return brand;
                }

                // product details tables
                var brandRow = doc.DocumentNode.SelectSingleNode("//table[contains(@id,'productDetails_techSpec_section') or contains(@id,'productDetails_detailBullets_sections')]//tr[.//th[contains(translate(normalize-space(text()), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'brand')]]/td");
                if (brandRow != null)
                {
                    var brand = brandRow.InnerText?.Trim();
                    if (!string.IsNullOrWhiteSpace(brand)) return brand;
                }
            }

            return null;
        }

        private static void ApplyAmazonOverrides(HtmlDocument doc, ProductImportResultDto result)
        {
            if (!result.Price.HasValue)
            {
                result.Price = TryExtractAmazonPrice(doc, out var listPrice);
                if (listPrice.HasValue && !result.ListPrice.HasValue)
                {
                    result.ListPrice = listPrice;
                }
            }
            else if (!result.ListPrice.HasValue)
            {
                var listPrice = TryExtractAmazonListPrice(doc);
                if (listPrice.HasValue) result.ListPrice = listPrice;
            }

            var amazonDescription = TryExtractAmazonDescription(doc);
            if (!string.IsNullOrWhiteSpace(amazonDescription))
            {
                if (string.IsNullOrWhiteSpace(result.Description) || amazonDescription.Length >= result.Description.Length)
                {
                    result.Description = amazonDescription;
                }
                else if (!result.Description.Contains(amazonDescription, StringComparison.OrdinalIgnoreCase))
                {
                    result.Description = $"{amazonDescription}\n\n{result.Description}";
                }
            }

            // Ensure we capture all image variants from the gallery
            TryAppendAmazonImages(doc, result);
            AppendAmazonAltImages(doc, result);
        }

        private static decimal? TryExtractAmazonPrice(HtmlDocument doc, out decimal? listPrice)
        {
            listPrice = TryExtractAmazonListPrice(doc);

            var priceCandidates = new[]
            {
                "priceblock_ourprice",
                "priceblock_dealprice",
                "priceblock_saleprice",
                "priceblock_pospromoprice"
            };

            foreach (var id in priceCandidates)
            {
                var node = doc.DocumentNode.SelectSingleNode($"//*[@id='{id}']");
                var value = node?.InnerText?.Trim();
                var parsed = TryParseDecimal(value);
                if (parsed.HasValue) return parsed;
            }

            var priceToPay = doc.DocumentNode.SelectSingleNode("//span[@id='priceToPay']//span[contains(@class,'a-offscreen')]");
            var priceToPayValue = priceToPay?.InnerText?.Trim();
            var priceParsed = TryParseDecimal(priceToPayValue);
            if (priceParsed.HasValue) return priceParsed;

            var corePrice = doc.DocumentNode.SelectSingleNode("//div[@id='corePriceDisplay_desktop_feature_div']//span[contains(@class,'a-offscreen')]");
            var corePriceValue = corePrice?.InnerText?.Trim();
            priceParsed = TryParseDecimal(corePriceValue);
            if (priceParsed.HasValue) return priceParsed;

            var offscreen = doc.DocumentNode.SelectSingleNode("(//span[contains(@class,'a-offscreen')])[1]");
            var offscreenValue = offscreen?.InnerText?.Trim();
            priceParsed = TryParseDecimal(offscreenValue);
            if (priceParsed.HasValue) return priceParsed;

            return null;
        }

        private static decimal? TryExtractAmazonListPrice(HtmlDocument doc)
        {
            var listPriceNode = doc.DocumentNode.SelectSingleNode("//span[contains(@class,'a-text-price')]/span[contains(@class,'a-offscreen')]");
            var listPriceValue = listPriceNode?.InnerText?.Trim();
            var parsed = TryParseDecimal(listPriceValue);
            if (parsed.HasValue) return parsed;

            var strike = doc.DocumentNode.SelectSingleNode("//span[contains(@class,'a-price') and .//span[contains(@class,'a-text-strike')]]//span[contains(@class,'a-offscreen')]");
            var strikeValue = strike?.InnerText?.Trim();
            parsed = TryParseDecimal(strikeValue);
            if (parsed.HasValue) return parsed;

            var listPriceAlt = doc.DocumentNode.SelectSingleNode("//span[@data-a-strike='true']//span[contains(@class,'a-offscreen')]");
            var listPriceAltValue = listPriceAlt?.InnerText?.Trim();
            parsed = TryParseDecimal(listPriceAltValue);
            if (parsed.HasValue) return parsed;

            return null;
        }

        private static string TryExtractAmazonDescription(HtmlDocument doc)
        {
            var bullets = doc.DocumentNode.SelectNodes("//div[@id='feature-bullets']//li//span[@class='a-list-item']");
            if (bullets != null && bullets.Count > 0)
            {
                var items = bullets
                    .Select(b => WebUtility.HtmlDecode(b.InnerText)?.Trim())
                    .Where(t => !string.IsNullOrWhiteSpace(t))
                    .Distinct()
                    .ToList();
                if (items.Count > 0)
                {
                    return string.Join("\n", items);
                }
            }

            var description = doc.DocumentNode.SelectSingleNode("//div[@id='productDescription']//p") ??
                              doc.DocumentNode.SelectSingleNode("//div[@id='productDescription']");
            var text = description?.InnerText?.Trim();
            if (!string.IsNullOrWhiteSpace(text))
            {
                return WebUtility.HtmlDecode(text).Trim();
            }

            return null;
        }

        private static string TryExtractAmazonTitle(HtmlDocument doc)
        {
            var titleNode = doc.DocumentNode.SelectSingleNode("//span[@id='productTitle']");
            var title = titleNode?.InnerText?.Trim();
            return string.IsNullOrWhiteSpace(title) ? null : WebUtility.HtmlDecode(title).Trim();
        }

        private static void AppendAmazonAltImages(HtmlDocument doc, ProductImportResultDto result)
        {
            var nodes = doc.DocumentNode.SelectNodes("//div[@id='altImages']//img");
            if (nodes == null) return;

            foreach (var node in nodes)
            {
                if (HasVideoAncestor(node)) continue;

                AppendImageFromAttr(result, node, "data-src");
                AppendImageFromAttr(result, node, "src");
            }
        }

        private static bool HasVideoAncestor(HtmlNode node)
        {
            var current = node;
            while (current != null)
            {
                if (current.Attributes != null)
                {
                    if (current.Attributes.Any(a =>
                            a.Name.Equals("data-video-url", StringComparison.OrdinalIgnoreCase) ||
                            a.Name.Equals("data-video", StringComparison.OrdinalIgnoreCase) ||
                            a.Name.Equals("data-vid", StringComparison.OrdinalIgnoreCase)))
                    {
                        return true;
                    }
                }
                current = current.ParentNode;
            }

            return false;
        }

        private static bool IsAmazonVideoUrl(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return false;
            var lowered = url.ToLowerInvariant();
            return lowered.Contains(".mp4") ||
                   lowered.Contains(".webm") ||
                   lowered.Contains("/video") ||
                   lowered.Contains("/videos");
        }

        private static string NormalizeAmazonImageUrl(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return url;

            // Remove size/variant markers like ._AC_SX679_. before extension
            var normalized = Regex.Replace(url, @"\._[^.]+(?=\.)", string.Empty);
            return normalized;
        }

        private static string ReplaceAmazonBranding(string text, Uri uri)
        {
            if (string.IsNullOrWhiteSpace(text)) return text;
            if (!IsAmazonHost(uri.Host)) return text;

            var replaced = text.Replace("Amazon.com", "primeshipuk.com", StringComparison.OrdinalIgnoreCase)
                               .Replace("Amazon", "Prime Ship UK", StringComparison.OrdinalIgnoreCase);
            return replaced;
        }

        private static void TryAppendAmazonImages(HtmlDocument doc, ProductImportResultDto result)
        {
            if (doc == null || result == null) return;

            var primaryImage = doc.DocumentNode.SelectSingleNode("//img[@id='landingImage' or @id='imgBlkFront']");
            if (primaryImage != null)
            {
                AppendImageFromAttr(result, primaryImage, "data-a-hires");
                AppendImageFromAttr(result, primaryImage, "data-old-hires");
                AppendImageFromAttr(result, primaryImage, "src");

                var dynamicRaw = primaryImage.GetAttributeValue("data-a-dynamic-image", null);
                AppendDynamicImages(result, dynamicRaw);
            }

            if (result.Images.Count > 0) return;

            var dynamicNodes = doc.DocumentNode.SelectNodes("//img[@data-a-dynamic-image]");
            if (dynamicNodes == null) return;

            foreach (var node in dynamicNodes)
            {
                var dynamicRaw = node.GetAttributeValue("data-a-dynamic-image", null);
                AppendDynamicImages(result, dynamicRaw);
                if (result.Images.Count > 0) return;
            }
        }

        private static void AppendImageFromAttr(ProductImportResultDto result, HtmlNode node, string attr)
        {
            var value = node?.GetAttributeValue(attr, null);
            if (string.IsNullOrWhiteSpace(value)) return;
            value = WebUtility.HtmlDecode(value)?.Trim();
            if (string.IsNullOrWhiteSpace(value)) return;
            if (!result.Images.Contains(value))
            {
                result.Images.Add(value);
            }
        }

        private static void AppendDynamicImages(ProductImportResultDto result, string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return;

            var decoded = WebUtility.HtmlDecode(raw)?.Trim();
            if (string.IsNullOrWhiteSpace(decoded)) return;

            try
            {
                using var json = JsonDocument.Parse(decoded);
                if (json.RootElement.ValueKind != JsonValueKind.Object) return;

                foreach (var prop in json.RootElement.EnumerateObject())
                {
                    var url = prop.Name?.Trim();
                    if (string.IsNullOrWhiteSpace(url)) continue;
                    if (!result.Images.Contains(url))
                    {
                        result.Images.Add(url);
                    }
                }
            }
            catch
            {
                // ignore invalid dynamic image payload
            }
        }

        private static bool LooksLikeAmazonBlockedPage(string html)
        {
            if (string.IsNullOrWhiteSpace(html)) return true;

            var lowered = html.ToLowerInvariant();
            if (lowered.Contains("robot check")) return true;
            if (lowered.Contains("sorry, we just need to make sure you're not a robot")) return true;
            if (lowered.Contains("automated access to amazon data")) return true;
            if (lowered.Contains("/errors/validatecaptcha")) return true;
            if (lowered.Contains("type=\"captcha\"")) return true;
            if (lowered.Contains("enter the characters you see")) return true;

            return false;
        }

        private static string ExtractAmazonBrandFromByline(string byline)
        {
            if (string.IsNullOrWhiteSpace(byline)) return null;
            var trimmed = WebUtility.HtmlDecode(byline).Trim();

            var brandPrefix = "Brand:";
            if (trimmed.StartsWith(brandPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return trimmed.Substring(brandPrefix.Length).Trim();
            }

            var visitPrefix = "Visit the ";
            var storeSuffix = " Store";
            var visitIndex = trimmed.IndexOf(visitPrefix, StringComparison.OrdinalIgnoreCase);
            var storeIndex = trimmed.IndexOf(storeSuffix, StringComparison.OrdinalIgnoreCase);
            if (visitIndex >= 0 && storeIndex > visitIndex)
            {
                var brand = trimmed.Substring(visitIndex + visitPrefix.Length, storeIndex - (visitIndex + visitPrefix.Length));
                return brand.Trim();
            }

            return null;
        }

        private static void TryParseJsonLd(HtmlDocument doc, ProductImportResultDto result)
        {
            var nodes = doc.DocumentNode.SelectNodes("//script[@type='application/ld+json']");
            if (nodes == null) return;

            foreach (var node in nodes)
            {
                var json = node.InnerText?.Trim();
                if (string.IsNullOrWhiteSpace(json)) continue;

                try
                {
                    using var docJson = JsonDocument.Parse(json);
                    if (TryFindProductElement(docJson.RootElement, out var productEl))
                    {
                        ApplyProductJson(productEl, result);
                    }
                }
                catch
                {
                    // ignore invalid JSON-LD blocks
                }
            }
        }

        private static bool TryFindProductElement(JsonElement element, out JsonElement productEl)
        {
            productEl = default;

            if (element.ValueKind == JsonValueKind.Object)
            {
                if (IsProductType(element))
                {
                    productEl = element;
                    return true;
                }

                foreach (var prop in element.EnumerateObject())
                {
                    if (TryFindProductElement(prop.Value, out productEl))
                    {
                        return true;
                    }
                }
            }
            else if (element.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in element.EnumerateArray())
                {
                    if (TryFindProductElement(item, out productEl))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private static bool IsProductType(JsonElement element)
        {
            if (element.TryGetProperty("@type", out var type))
            {
                if (type.ValueKind == JsonValueKind.String)
                {
                    return type.GetString()?.IndexOf("Product", StringComparison.OrdinalIgnoreCase) >= 0;
                }

                if (type.ValueKind == JsonValueKind.Array)
                {
                    foreach (var t in type.EnumerateArray())
                    {
                        if (t.ValueKind == JsonValueKind.String &&
                            t.GetString()?.IndexOf("Product", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        private static void ApplyProductJson(JsonElement productEl, ProductImportResultDto result)
        {
            if (string.IsNullOrWhiteSpace(result.Name))
            {
                result.Name = GetJsonString(productEl, "name");
            }

            if (string.IsNullOrWhiteSpace(result.Description))
            {
                result.Description = GetJsonString(productEl, "description");
            }

            if (string.IsNullOrWhiteSpace(result.Brand))
            {
                if (productEl.TryGetProperty("brand", out var brandEl))
                {
                    result.Brand = brandEl.ValueKind == JsonValueKind.String
                        ? brandEl.GetString()
                        : GetJsonString(brandEl, "name");
                }
            }

            if (productEl.TryGetProperty("image", out var imageEl))
            {
                var images = ExtractImages(imageEl);
                foreach (var img in images)
                {
                    if (!result.Images.Contains(img))
                    {
                        result.Images.Add(img);
                    }
                }
            }

            if (!result.Price.HasValue || string.IsNullOrWhiteSpace(result.Currency))
            {
                if (productEl.TryGetProperty("offers", out var offersEl))
                {
                    ApplyOffersJson(offersEl, result);
                }
            }

            if (string.IsNullOrWhiteSpace(result.CategoryHint))
            {
                result.CategoryHint = GetJsonString(productEl, "category");
            }
        }

        private static void ApplyOffersJson(JsonElement offersEl, ProductImportResultDto result)
        {
            if (offersEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var offer in offersEl.EnumerateArray())
                {
                    ApplyOffersJson(offer, result);
                    if (result.Price.HasValue) return;
                }
            }

            if (offersEl.ValueKind != JsonValueKind.Object) return;

            if (!result.Price.HasValue)
            {
                var priceRaw = GetJsonString(offersEl, "price");
                result.Price = TryParseDecimal(priceRaw);
            }

            if (string.IsNullOrWhiteSpace(result.Currency))
            {
                result.Currency = GetJsonString(offersEl, "priceCurrency");
            }

            if (!result.ListPrice.HasValue && offersEl.TryGetProperty("priceSpecification", out var specEl))
            {
                var listPrice = GetJsonString(specEl, "price");
                result.ListPrice = TryParseDecimal(listPrice);
            }
        }

        private static IEnumerable<string> ExtractImages(JsonElement imageEl)
        {
            if (imageEl.ValueKind == JsonValueKind.String)
            {
                yield return imageEl.GetString();
                yield break;
            }

            if (imageEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var img in imageEl.EnumerateArray())
                {
                    if (img.ValueKind == JsonValueKind.String)
                    {
                        yield return img.GetString();
                    }
                }
            }
        }

        private static string GetJsonString(JsonElement element, string property)
        {
            if (element.ValueKind != JsonValueKind.Object) return null;
            if (!element.TryGetProperty(property, out var value)) return null;
            if (value.ValueKind == JsonValueKind.String) return value.GetString();
            return null;
        }

        private static string GetMetaContent(HtmlDocument doc, string nameOrProperty)
        {
            var meta = doc.DocumentNode.SelectSingleNode($"//meta[@property='{nameOrProperty}']") ??
                       doc.DocumentNode.SelectSingleNode($"//meta[@name='{nameOrProperty}']");
            return meta?.GetAttributeValue("content", null);
        }

        private static string GetTitle(HtmlDocument doc)
        {
            return doc.DocumentNode.SelectSingleNode("//title")?.InnerText?.Trim();
        }

        private static decimal? TryParseDecimal(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var cleaned = new string(value.Where(c => char.IsDigit(c) || c == '.' || c == ',').ToArray());
            if (string.IsNullOrWhiteSpace(cleaned)) return null;

            cleaned = cleaned.Replace(",", "");
            if (decimal.TryParse(cleaned, NumberStyles.Number, CultureInfo.InvariantCulture, out var result))
            {
                return result;
            }

            return null;
        }
    }
}
