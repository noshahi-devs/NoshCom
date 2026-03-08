using AutoMapper;
using Elicom.Entities;
using Elicom.OrderItems.Dto;
using System;
using System.Text.Json;

namespace Elicom.Orders.Dto
{
    public class OrderItemImageUrlResolver : IValueResolver<OrderItem, OrderItemDto, string>
    {
        public string Resolve(OrderItem source, OrderItemDto destination, string destMember, ResolutionContext context)
        {
            if (source.StoreProduct?.Product == null || string.IsNullOrEmpty(source.StoreProduct.Product.Images))
            {
                return "";
            }

            var raw = source.StoreProduct.Product.Images;
            var firstImage = TryExtractFirstImage(raw);
            return NormalizeImageUrl(firstImage);
        }

        private static string TryExtractFirstImage(string raw)
        {
            var value = raw?.Trim();
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            // Prefer JSON parse when input is array/string JSON.
            if (value.StartsWith("[", StringComparison.Ordinal))
            {
                try
                {
                    using var doc = JsonDocument.Parse(value);
                    if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                    {
                        var first = doc.RootElement[0];
                        if (first.ValueKind == JsonValueKind.String)
                        {
                            return first.GetString() ?? string.Empty;
                        }
                    }
                }
                catch
                {
                    // Fallback below
                }

                // Legacy fallback for broken pseudo-array strings
                var core = value.Trim('[', ']');
                var parts = core.Split(',', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length > 0)
                {
                    return parts[0];
                }
            }
            else if (value.StartsWith("\"", StringComparison.Ordinal) && value.EndsWith("\"", StringComparison.Ordinal))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<string>(value);
                    return parsed ?? string.Empty;
                }
                catch
                {
                    return value.Trim('"');
                }
            }

            return value;
        }

        private static string NormalizeImageUrl(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var cleaned = value
                .Replace("\r", string.Empty)
                .Replace("\n", string.Empty)
                .Trim();

            // Handle values like \"https://... (broken escaped quote prefix)
            while (cleaned.StartsWith("\\\"", StringComparison.Ordinal))
            {
                cleaned = cleaned.Substring(2).TrimStart();
            }

            cleaned = cleaned.Trim(' ', '"', '\'');
            return cleaned;
        }
    }
}
