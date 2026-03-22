using System;
using System.Reflection;
using Elicom.ProductImport;
using Shouldly;
using Xunit;

namespace Elicom.Tests.Products
{
    public class ProductImport_Tests
    {
        [Fact]
        public void Should_Parse_Amazon_ProductTitle_When_Meta_Missing()
        {
            var html = "<html><head><title>Amazon.com</title></head><body>" +
                       "<span id='productTitle'>Grace &amp; Stella Purple Treatment Gels</span>" +
                       "</body></html>";
            var uri = new Uri("https://www.amazon.com/dp/B0CPT8W3RV");

            var result = InvokePrivateStatic<ProductImportResultDto>("ParseProductFromHtml", html, uri);

            result.Name.ShouldBe("Grace & Stella Purple Treatment Gels");
        }

        [Fact]
        public void Should_Detect_Amazon_Robot_Check_Page()
        {
            var html = "<html><head><title>Robot Check</title></head><body>" +
                       "<form action='/errors/validatecaptcha'><input type='text' name='captcha'></form>" +
                       "</body></html>";

            var blocked = InvokePrivateStatic<bool>("LooksLikeAmazonBlockedPage", html);

            blocked.ShouldBeTrue();
        }

        private static T InvokePrivateStatic<T>(string methodName, params object[] args)
        {
            var method = typeof(ProductImportAppService).GetMethod(methodName, BindingFlags.NonPublic | BindingFlags.Static);
            method.ShouldNotBeNull($"Expected method '{methodName}' to exist.");

            return (T)method.Invoke(null, args);
        }
    }
}
