using System;

namespace Elicom.Common
{
    public static class EmailBrandingHelper
    {
        public const string SmartShopPrimaryColor = "#F2BB13";
        public const string SmartShopSupportEmail = "support@thesmartshop.uk";
        public const string SmartShopPlatformName = "Smart Shop UK";
        public const string SmartShopFooterBrand = "SMART SHOP UK";
        public const string SmartShopFooterCompany = "Smart Shop UK";

        public static (string PlatformName, string BrandColor, string SupportEmail, string FooterBrand, string FooterCompany) Resolve(string sourcePlatform)
        {
            var platform = (sourcePlatform ?? string.Empty).Trim();

            if (platform.Contains("Prime", StringComparison.OrdinalIgnoreCase))
            {
                return ("Prime Ship UK", "#f85606", "support@primeshipuk.com", "PRIME SHIP UK", "Prime Ship UK");
            }

            if (platform.Contains("Finora", StringComparison.OrdinalIgnoreCase) ||
                platform.Contains("Easy", StringComparison.OrdinalIgnoreCase))
            {
                return ("Easy Finora", "#28a745", "support@easyfinora.com", "EASY FINORA", "Easy Finora");
            }

            return (SmartShopPlatformName, SmartShopPrimaryColor, SmartShopSupportEmail, SmartShopFooterBrand, SmartShopFooterCompany);
        }

        public static (string PlatformName, string BrandColor, string SupportEmail, string FooterBrand, string FooterCompany) ResolveForOrderInvoice(string sourcePlatform)
        {
            return (SmartShopPlatformName, SmartShopPrimaryColor, SmartShopSupportEmail, SmartShopFooterBrand, SmartShopFooterCompany);
        }

        public static string NormalizeSenderDisplayName(string platformName)
        {
            if (string.IsNullOrWhiteSpace(platformName) || IsSmartShopPlatform(platformName))
            {
                return SmartShopPlatformName;
            }

            return platformName;
        }

        public static bool IsSmartShopPlatform(string platformName)
        {
            if (string.IsNullOrWhiteSpace(platformName))
            {
                return true;
            }

            return platformName.Contains("World Cart", StringComparison.OrdinalIgnoreCase) ||
                   platformName.Contains("WorldCart", StringComparison.OrdinalIgnoreCase) ||
                   platformName.Contains("Smart Shop", StringComparison.OrdinalIgnoreCase) ||
                   platformName.Contains("SmartStore", StringComparison.OrdinalIgnoreCase) ||
                   platformName.Contains("Smart Store", StringComparison.OrdinalIgnoreCase) ||
                   platformName.Contains("Elicom", StringComparison.OrdinalIgnoreCase);
        }

        public static string GetHeroTextColor(string brandColor)
        {
            return string.Equals(brandColor, SmartShopPrimaryColor, StringComparison.OrdinalIgnoreCase)
                ? "#111827"
                : "#ffffff";
        }

        public static bool IsCardPayment(string paymentMethod, string paymentStatus = null)
        {
            var method = (paymentMethod ?? string.Empty).Trim().ToLowerInvariant();
            var status = (paymentStatus ?? string.Empty).Trim();

            if (method.Contains("finora") || method == "card" || method.Contains("visa"))
            {
                return true;
            }

            return status.Contains("Easy Finora", StringComparison.OrdinalIgnoreCase);
        }

        public static string FormatPaymentMethodForEmail(string paymentMethod, string paymentStatus = null)
        {
            if (IsCardPayment(paymentMethod, paymentStatus))
            {
                return "Card";
            }

            return string.IsNullOrWhiteSpace(paymentMethod) ? "-" : paymentMethod.Trim();
        }
    }
}
