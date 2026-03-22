using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.UI;
using Abp.Net.Mail;
using Elicom.Entities;
using Elicom.SupplierOrders.Dto;
using Elicom.Wallets;
using Elicom.Authorization;
using Elicom.Wholesale.Dto;
using Elicom.Cards;
using Elicom.Authorization.Users;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;

namespace Elicom.Wholesale
{
    [AbpAuthorize(PermissionNames.Pages_PrimeShip)]
    [Abp.Domain.Uow.UnitOfWork(System.Transactions.TransactionScopeOption.Suppress)]
    public class WholesaleAppService : ElicomAppServiceBase, IWholesaleAppService
    {
        private readonly IRepository<Product, Guid> _productRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;
        private readonly IRepository<SupplierOrder, Guid> _supplierOrderRepository;
        private readonly IWalletManager _walletManager;
        private readonly IEmailSender _emailSender;
        private readonly ICardAppService _cardAppService;
        private readonly UserManager _userManager;

        public WholesaleAppService(
            IRepository<Product, Guid> productRepository,
            IRepository<StoreProduct, Guid> storeProductRepository,
            IRepository<SupplierOrder, Guid> supplierOrderRepository,
            IWalletManager walletManager,
            IEmailSender emailSender,
            ICardAppService cardAppService,
            UserManager userManager)
        {
            _productRepository = productRepository;
            _storeProductRepository = storeProductRepository;
            _supplierOrderRepository = supplierOrderRepository;
            _walletManager = walletManager;
            _emailSender = emailSender;
            _cardAppService = cardAppService;
            _userManager = userManager;
        }

        public async Task<SupplierOrderDto> PlaceWholesaleOrder(CreateWholesaleOrderInput input)
        {
            var user = await GetCurrentUserAsync();

            if (input.Items == null || !input.Items.Any())
            {
                throw new UserFriendlyException("Please select at least one product.");
            }

            // 1. Calculate Total Amount based on Wholesale Prices
            decimal totalAmount = 0;
            var orderItems = new List<SupplierOrderItem>();
            string primaryProductName = null;

            foreach (var item in input.Items)
            {
                if (item.Quantity <= 0)
                {
                    throw new UserFriendlyException("Quantity must be greater than zero.");
                }

                var product = await ResolveWholesaleProductAsync(item.ProductId);
                if (product == null)
                {
                    throw new UserFriendlyException("Selected product was not found. Please refresh your cart and try again.");
                }

                var supplierPrice = ResolveSupplierPrice(product);
                totalAmount += supplierPrice * item.Quantity;
                if (string.IsNullOrWhiteSpace(primaryProductName))
                {
                    primaryProductName = product.Name;
                }

                orderItems.Add(new SupplierOrderItem
                {
                    ProductId = product.Id,
                    Quantity = item.Quantity,
                    PurchasePrice = supplierPrice
                });
            }

            var paymentMethod = (input.PaymentMethod ?? string.Empty).Trim().ToLowerInvariant();
            if (paymentMethod == "card")
            {
                paymentMethod = "finora";
            }

            // Generate a consistent ReferenceCode
            var refCode = $"WHOLE-{DateTime.UtcNow:yyyyMMddHHmmss}";
            var trackingCode = NormalizeTrackingCode(
                await GenerateUniqueTrackingCodeAsync(primaryProductName),
                primaryProductName
            );

            // 2. Pay Upfront (Deduct from EasyFinora Card if method is finora)
            if (paymentMethod == "finora")
            {
                if (string.IsNullOrEmpty(input.CardNumber))
                {
                    throw new UserFriendlyException("Card number is required for EasyFinora payment.");
                }

                await _cardAppService.ProcessPayment(new ProcessCardPaymentInput
                {
                    CardNumber = input.CardNumber.Replace(" ", string.Empty),
                    ExpiryDate = input.ExpiryDate,
                    Cvv = input.Cvv,
                    Amount = totalAmount,
                    SourcePlatform = "PrimeShip",
                    Description = $"Wholesale purchase from PrimeShip for {input.CustomerName}",
                    ReferenceId = $"CARD-{refCode}"
                });
            }

            // 3. Resolve tenant admin as supplier destination
            var tenantId = AbpSession.TenantId;
            var tenantAdmin = await _userManager.Users
                .IgnoreQueryFilters()
                .Where(u => u.TenantId == tenantId && u.UserName == "admin")
                .FirstOrDefaultAsync();
            var supplierAdminId = tenantAdmin?.Id ?? 1;

            // 4. Create the Supplier Order
            var supplierOrder = new SupplierOrder
            {
                ReferenceCode = refCode,
                ResellerId = user.Id,
                SupplierId = supplierAdminId,
                TotalPurchaseAmount = totalAmount,
                Status = "Purchased",
                ShippingAddress = input.ShippingAddress,
                CustomerName = input.CustomerName,
                SourcePlatform = "PrimeShip",
                TrackingCode = trackingCode,
                Items = orderItems
            };

            await _supplierOrderRepository.InsertAsync(supplierOrder);

            // Automate Email
            try
            {
                var mail = new System.Net.Mail.MailMessage(
                    "no-reply@primeshipuk.com",
                    "noshahidevelopersinc@gmail.com"
                )
                {
                    Subject = $"New Wholesale Order: {supplierOrder.ReferenceCode}",
                    Body = $"A new wholesale order has been placed.\n\nTotal Amount: {totalAmount}\nCustomer: {input.CustomerName}\nRef: {supplierOrder.ReferenceCode}",
                    IsBodyHtml = false
                };

                await _emailSender.SendAsync(mail);
            }
            catch (Exception ex)
            {
                Logger.Error("Failed to send email notification", ex);
            }

            return ObjectMapper.Map<SupplierOrderDto>(supplierOrder);
        }

        private async Task<Product> ResolveWholesaleProductAsync(Guid incomingProductId)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var product = await _productRepository.GetAll()
                    .FirstOrDefaultAsync(p => p.Id == incomingProductId);

                if (product != null)
                {
                    return product;
                }

                // Backward compatibility: old carts might carry StoreProduct.Id instead of Product.Id.
                var storeProduct = await _storeProductRepository.GetAll()
                    .FirstOrDefaultAsync(sp => sp.Id == incomingProductId);

                if (storeProduct == null)
                {
                    return null;
                }

                return await _productRepository.GetAll()
                    .FirstOrDefaultAsync(p => p.Id == storeProduct.ProductId);
            }
        }

        private static decimal ResolveSupplierPrice(Product product)
        {
            var resellerMaxPrice = Math.Max(0m, product.ResellerMaxPrice);
            var discountPercentage = Math.Clamp(product.DiscountPercentage, 0m, 100m);
            var discounted = resellerMaxPrice - (resellerMaxPrice * discountPercentage / 100m);

            if (discounted > 0m || resellerMaxPrice > 0m)
            {
                return Math.Round(Math.Max(discounted, 0m), 2, MidpointRounding.AwayFromZero);
            }

            return Math.Round(Math.Max(product.SupplierPrice, 0m), 2, MidpointRounding.AwayFromZero);
        }

        private async Task<string> GenerateUniqueTrackingCodeAsync(string productName)
        {
            var initials = ExtractTrackingInitials(productName);

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                for (var attempt = 0; attempt < 30; attempt++)
                {
                    var candidate = $"UK-{initials}{GenerateTenDigitNumericPart()}";
                    var exists = await _supplierOrderRepository.GetAll()
                        .IgnoreQueryFilters()
                        .AnyAsync(x => x.TrackingCode == candidate);

                    if (!exists)
                    {
                        return candidate;
                    }
                }

                while (true)
                {
                    var fallbackDigits = (DateTime.UtcNow.Ticks % 10000000000L).ToString("D10");
                    var fallback = $"UK-{initials}{fallbackDigits}";
                    var exists = await _supplierOrderRepository.GetAll()
                        .IgnoreQueryFilters()
                        .AnyAsync(x => x.TrackingCode == fallback);
                    if (!exists)
                    {
                        return fallback;
                    }
                }
            }
        }

        private static string ExtractTrackingInitials(string productName)
        {
            var letters = new string((productName ?? string.Empty).Where(char.IsLetter).ToArray()).ToUpperInvariant();
            if (letters.Length == 0)
            {
                return "XX";
            }

            var first = letters[0];
            var last = letters[letters.Length - 1];
            return $"{first}{last}";
        }

        private static string GenerateTenDigitNumericPart()
        {
            var timePart = DateTime.UtcNow.ToString("HHmmss");
            var randomPart = RandomNumberGenerator.GetInt32(0, 10000).ToString("D4");
            return $"{timePart}{randomPart}";
        }

        private static string NormalizeTrackingCode(string trackingCode, string productName)
        {
            var value = (trackingCode ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(value))
            {
                return value;
            }

            if (IsTrackingCodeInNewFormat(value))
            {
                return value;
            }

            var initials = ExtractTrackingInitials(productName);
            var digits = new string(value.Where(char.IsDigit).ToArray());
            if (digits.Length == 0)
            {
                digits = GenerateTenDigitNumericPart();
            }
            else if (digits.Length < 10)
            {
                digits = digits.PadLeft(10, '0');
            }
            else if (digits.Length > 10)
            {
                digits = digits.Substring(digits.Length - 10, 10);
            }

            return $"UK-{initials}{digits}";
        }

        private static bool IsTrackingCodeInNewFormat(string trackingCode)
        {
            if (string.IsNullOrWhiteSpace(trackingCode))
            {
                return false;
            }

            if (!trackingCode.StartsWith("UK-", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (trackingCode.Length != 15)
            {
                return false;
            }

            var initials = trackingCode.Substring(3, 2);
            var digits = trackingCode.Substring(5, 10);

            return initials.All(char.IsLetter) && digits.All(char.IsDigit);
        }
    }
}
