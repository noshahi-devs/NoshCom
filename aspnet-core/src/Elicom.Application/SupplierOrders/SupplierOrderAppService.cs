using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.UI;
using Abp.Net.Mail;
using Elicom.Authorization;
using Elicom.Entities;
using Elicom.Orders.Dto;
using Elicom.SupplierOrders.Dto;
using Elicom.Wallets;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;

namespace Elicom.SupplierOrders
{
    [AbpAuthorize]
    [Abp.Domain.Uow.UnitOfWork(System.Transactions.TransactionScopeOption.Suppress)]
    public class SupplierOrderAppService : ElicomAppServiceBase, ISupplierOrderAppService
    {
        private readonly IRepository<Elicom.Entities.SupplierOrder, Guid> _supplierOrderRepository;
        private readonly IRepository<SupplierOrderItem, Guid> _supplierOrderItemRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;
        private readonly IRepository<Product, Guid> _productRepository;
        private readonly IRepository<AppTransaction, long> _appTransactionRepository;
        private readonly ISmartStoreWalletManager _smartStoreWalletManager;
        private readonly IWalletManager _walletManager;
        private readonly IEmailSender _emailSender;

        private const long PlatformAdminId = 1;

        public SupplierOrderAppService(
            IRepository<Elicom.Entities.SupplierOrder, Guid> supplierOrderRepository,
            IRepository<SupplierOrderItem, Guid> supplierOrderItemRepository,
            IRepository<StoreProduct, Guid> storeProductRepository,
            IRepository<Product, Guid> productRepository,
            IRepository<AppTransaction, long> appTransactionRepository,
            ISmartStoreWalletManager smartStoreWalletManager,
            IWalletManager walletManager,
            IEmailSender emailSender)
        {
            _supplierOrderRepository = supplierOrderRepository;
            _supplierOrderItemRepository = supplierOrderItemRepository;
            _storeProductRepository = storeProductRepository;
            _productRepository = productRepository;
            _appTransactionRepository = appTransactionRepository;
            _smartStoreWalletManager = smartStoreWalletManager;
            _walletManager = walletManager;
            _emailSender = emailSender;
        }

        public async Task<ListResultDto<SupplierOrderDto>> GetMyOrders()
        {
            var user = await GetCurrentUserAsync();

            var orders = await _supplierOrderRepository.GetAll()
                .IgnoreQueryFilters()
                .Include(x => x.Items).ThenInclude(i => i.Product)
                .Include(x => x.Reseller)
                .Where(x => x.SupplierId == user.Id || x.ResellerId == user.Id)
                .OrderByDescending(x => x.CreationTime)
                .ToListAsync();

            var changed = await EnsureTrackingCodesAsync(orders);
            if (changed)
            {
                await CurrentUnitOfWork.SaveChangesAsync();
            }

            return new ListResultDto<SupplierOrderDto>(orders.Select(MapSupplierOrderToDto).ToList());
        }

        public async Task<SupplierOrderDto> Create(CreateSupplierOrderDto input)
        {
            var user = await GetCurrentUserAsync();
            var tenantAdmin = await UserManager.Users
                .Where(u => u.TenantId == AbpSession.TenantId && u.UserName == "admin")
                .FirstOrDefaultAsync();

            var adminId = tenantAdmin?.Id ?? 1;

            if (input.Items == null || !input.Items.Any())
                throw new UserFriendlyException("Supplier order must contain items");

            var primaryProductName = await ResolvePrimaryProductNameAsync(input.Items);
            var supplierOrder = new SupplierOrder
            {
                ResellerId = user.Id, 
                SupplierId = adminId, 
                WarehouseAddress = input.WarehouseAddress,
                CustomerName = input.CustomerName,
                ShippingAddress = input.ShippingAddress,
                Status = "Pending", 
                ReferenceCode = GenerateReferenceCode(),
                TrackingCode = NormalizeTrackingCode(
                    await GenerateUniqueTrackingCodeAsync(primaryProductName),
                    primaryProductName
                ),
                SourcePlatform = "Primeship",
                TotalPurchaseAmount = input.Items.Sum(i => i.Quantity * i.PurchasePrice)
            };

            if (input.SupplierId > 0)
            {
                supplierOrder.SupplierId = input.SupplierId;
            }

            await _supplierOrderRepository.InsertAsync(supplierOrder);

            foreach (var item in input.Items)
            {
                var supplierOrderItem = new SupplierOrderItem
                {
                    SupplierOrderId = supplierOrder.Id,
                    ProductId = item.ProductId,
                    Quantity = item.Quantity,
                    PurchasePrice = item.PurchasePrice
                };

                await _supplierOrderItemRepository.InsertAsync(supplierOrderItem);
            }

            return MapSupplierOrderToDto(supplierOrder);
        }

        public async Task<SupplierOrderDto> Get(Guid id)
        {
            var user = await GetCurrentUserAsync();
            var supplierOrder = await _supplierOrderRepository.GetAll()
                .IgnoreQueryFilters()
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (supplierOrder == null)
                throw new UserFriendlyException("Supplier order not found");

            if (supplierOrder.SupplierId != user.Id && supplierOrder.ResellerId != user.Id)
            {
                 throw new UserFriendlyException("Access denied.");
            }

            var changed = await EnsureTrackingCodeAsync(supplierOrder);
            if (changed)
            {
                await CurrentUnitOfWork.SaveChangesAsync();
            }
            return MapSupplierOrderToDto(supplierOrder);
        }

        public async Task MarkAsShipped(FulfillOrderDto input)
        {
            var user = await GetCurrentUserAsync();
            
            SupplierOrder order = null;
            if (Guid.TryParse(input.Id, out Guid guidId))
            {
                order = await _supplierOrderRepository.FirstOrDefaultAsync(x => x.Id == guidId && x.SupplierId == user.Id);
            }
            
            if (order == null)
            {
                order = await _supplierOrderRepository.FirstOrDefaultAsync(x => x.ReferenceCode == input.Id && x.SupplierId == user.Id);
            }
            
            if (order == null) throw new UserFriendlyException("Order not found or access denied.");
            
            order.Status = "Shipped";
            order.ShipmentDate = input.ShipmentDate;
            order.CarrierId = input.CarrierId;
            var primaryProductName = await ResolvePrimaryProductNameAsync(order);
            order.TrackingCode = NormalizeTrackingCode(input.TrackingCode, primaryProductName);

            await _supplierOrderRepository.UpdateAsync(order);

            try
            {
                var mail = new System.Net.Mail.MailMessage("no-reply@primeshipuk.com", "noshahidevelopersinc@gmail.com")
                {
                    Subject = $"[SmartStore Hub] Shipment Alert: {order.ReferenceCode}",
                    Body = $"Seller {user.Name} has shipped items for order {order.ReferenceCode} to the Hub.\n\nCarrier: {order.CarrierId}\nTracking: {order.TrackingCode}",
                    IsBodyHtml = false
                };
                await _emailSender.SendAsync(mail);
            }
            catch (Exception ex) { Logger.Error("Email failed: " + ex.Message); }
        }

        public async Task MarkAsDelivered(Guid id)
        {
            var user = await GetCurrentUserAsync();
            var order = await _supplierOrderRepository.FirstOrDefaultAsync(x => x.Id == id && x.SupplierId == user.Id);
            
            if (order == null) throw new UserFriendlyException("Order not found or access denied.");
            
            order.Status = "Delivered";
            await _supplierOrderRepository.UpdateAsync(order);

            try
            {
                var mail = new System.Net.Mail.MailMessage("no-reply@primeshipuk.com", "noshahidevelopersinc@gmail.com")
                {
                    Subject = $"[PrimeShip] Order Delivered: {order.ReferenceCode}",
                    Body = $"Wholesale order {order.ReferenceCode} has been marked as DELIVERED.\n\nCustomer: {order.CustomerName}",
                    IsBodyHtml = false
                };
                await _emailSender.SendAsync(mail);
            }
            catch (Exception ex) { Logger.Error("Email failed: " + ex.Message); }
        }

        [AbpAuthorize(PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_SmartStore_Admin, PermissionNames.Admin)]
        public async Task<SupplierOrderDto> MarkAsVerified(Guid id)
        {
            var order = await _supplierOrderRepository.GetAll()
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Order)
                .FirstOrDefaultAsync(so => so.Id == id);
                
            if (order == null) throw new UserFriendlyException("Supplier order not found");

            if (order.Status == "Verified")
                return MapSupplierOrderToDto(order);

            order.Status = "Verified";

            if (order.OrderId.HasValue && order.Order != null)
            {
                var amountToRelease = order.TotalPurchaseAmount;
                
                await _appTransactionRepository.InsertAsync(new AppTransaction
                {
                    UserId = order.SupplierId,
                    Amount = amountToRelease,
                    MovementType = "Credit",
                    Category = "Sale",
                    ReferenceId = order.ReferenceCode,
                    OrderId = order.OrderId,
                    Status = "Approved",
                    Description = $"Proceeds for Supplier Order {order.ReferenceCode} (Verified at Hub)"
                });

                await _smartStoreWalletManager.CreditAsync(
                    order.SupplierId,
                    amountToRelease,
                    order.ReferenceCode,
                    $"Payment for Verified Hub Delivery: {order.ReferenceCode}"
                );
            }

            await _supplierOrderRepository.UpdateAsync(order);
            return MapSupplierOrderToDto(order);
        }

        [AbpAuthorize(PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_SmartStore_Admin, PermissionNames.Admin)]
        public async Task<ListResultDto<SupplierOrderDto>> GetAll()
        {
            var orders = await _supplierOrderRepository.GetAll()
                .IgnoreQueryFilters()
                .Include(x => x.Items).ThenInclude(i => i.Product)
                .Include(x => x.Reseller)
                .OrderByDescending(x => x.CreationTime)
                .ToListAsync();

            var changed = await EnsureTrackingCodesAsync(orders);
            if (changed)
            {
                await CurrentUnitOfWork.SaveChangesAsync();
            }
            return new ListResultDto<SupplierOrderDto>(orders.Select(MapSupplierOrderToDto).ToList());
        }

        [AbpAuthorize(PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_SmartStore_Admin, PermissionNames.Admin)]
        [HttpPost]
        [HttpPatch]
        [HttpPut]
        public async Task<SupplierOrderDto> UpdateStatus(Elicom.Orders.Dto.UpdateOrderStatusDto input)
        {
            var order = await _supplierOrderRepository.GetAll()
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.Id == input.Id);
                
            if (order == null) throw new UserFriendlyException("Wholesale order not found");
            
            var oldStatus = order.Status;
            var newStatus = (input.Status ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(newStatus))
            {
                throw new UserFriendlyException("Order status is required.");
            }

            // Refund logic for cancelled orders
            if (newStatus.Equals("Cancel", StringComparison.OrdinalIgnoreCase) || 
                newStatus.Equals("Cancelled", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.Equals(oldStatus, "Cancelled", StringComparison.OrdinalIgnoreCase))
                {
                    await HandleOrderRefund(order);
                }
            }
            
            order.Status = newStatus;
            await _supplierOrderRepository.UpdateAsync(order);
            
            return MapSupplierOrderToDto(order);
        }

        private async Task HandleOrderRefund(SupplierOrder order)
        {
            var cardRefId = $"CARD-{order.ReferenceCode}";
            AppTransaction priorTransaction;
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                priorTransaction = await _appTransactionRepository.GetAll()
                    .IgnoreQueryFilters()
                    .Where(t => t.ReferenceId == cardRefId && t.MovementType == "Debit")
                    .OrderByDescending(t => t.CreationTime)
                    .FirstOrDefaultAsync();
            }

            if (priorTransaction == null) return;

            var refundRefId = $"REFUND-{order.ReferenceCode}";
            var targetTenantId = priorTransaction.TenantId;

            using (UnitOfWorkManager.Current.SetTenantId(targetTenantId))
            {
                var priorRefund = await _appTransactionRepository.GetAll()
                    .AnyAsync(t => t.ReferenceId == refundRefId);

                if (priorRefund) return;

                var amountToRefund = Math.Abs(priorTransaction.Amount);

                await _appTransactionRepository.InsertAsync(new AppTransaction
                {
                    TenantId = targetTenantId,
                    UserId = priorTransaction.UserId,
                    CardId = priorTransaction.CardId,
                    Amount = amountToRefund,
                    MovementType = "Credit",
                    Category = "Card Refund",
                    ReferenceId = refundRefId,
                    Description = $"Refund for Cancelled Order: {order.ReferenceCode}",
                    Status = "Approved"
                });

                if (targetTenantId == 1)
                {
                    await _smartStoreWalletManager.CreditAsync(
                        priorTransaction.UserId,
                        amountToRefund,
                        refundRefId,
                        $"Refund for Cancelled Order: {order.ReferenceCode}",
                        movementType: "Refund"
                    );
                }
                else
                {
                    await _walletManager.DepositAsync(
                        priorTransaction.UserId,
                        amountToRefund,
                        refundRefId,
                        $"Refund for Cancelled Order: {order.ReferenceCode}"
                    );
                }
            }
        }

        private string GenerateReferenceCode()
        {
            return $"SUP-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";
        }

        private async Task<bool> EnsureTrackingCodeAsync(SupplierOrder order)
        {
            if (order == null)
            {
                return false;
            }

            if (!string.IsNullOrWhiteSpace(order.TrackingCode) && IsTrackingCodeInNewFormat(order.TrackingCode))
            {
                return false;
            }

            var primaryProductName = await ResolvePrimaryProductNameAsync(order);

            if (!string.IsNullOrWhiteSpace(order.TrackingCode))
            {
                var normalized = NormalizeTrackingCode(order.TrackingCode, primaryProductName);
                order.TrackingCode = await EnsureUniqueTrackingCodeAsync(normalized, primaryProductName, order.Id);
            }
            else
            {
                order.TrackingCode = NormalizeTrackingCode(
                    await GenerateUniqueTrackingCodeAsync(primaryProductName),
                    primaryProductName
                );
            }

            await _supplierOrderRepository.UpdateAsync(order);
            return true;
        }

        private async Task<bool> EnsureTrackingCodesAsync(IEnumerable<SupplierOrder> orders)
        {
            if (orders == null)
            {
                return false;
            }

            var changed = false;
            foreach (var order in orders)
            {
                changed = await EnsureTrackingCodeAsync(order) || changed;
            }

            return changed;
        }

        private SupplierOrderDto MapSupplierOrderToDto(SupplierOrder order)
        {
            if (order == null)
            {
                return null;
            }

            return new SupplierOrderDto
            {
                Id = order.Id,
                ReferenceCode = order.ReferenceCode,
                ResellerId = order.ResellerId,
                SupplierId = order.SupplierId,
                TotalPurchaseAmount = order.TotalPurchaseAmount,
                CreationTime = order.CreationTime,
                WarehouseAddress = order.WarehouseAddress,
                ShippingAddress = order.ShippingAddress,
                CustomerName = order.CustomerName,
                Status = order.Status,
                SellerId = order.ResellerId,
                SellerName = order.Reseller != null
                    ? $"{order.Reseller.Name} {order.Reseller.Surname}".Trim()
                    : "Unknown",
                ShipmentDate = order.ShipmentDate,
                CarrierId = order.CarrierId,
                TrackingCode = order.TrackingCode,
                OrderId = order.OrderId,
                Items = (order.Items ?? new List<SupplierOrderItem>())
                    .Select(item => new SupplierOrderItemDto
                    {
                        Id = item.Id,
                        SupplierOrderId = item.SupplierOrderId,
                        ProductId = item.ProductId,
                        Quantity = item.Quantity,
                        PurchasePrice = item.PurchasePrice,
                        ProductName = item.Product != null ? item.Product.Name : string.Empty
                    })
                    .ToList()
            };
        }

        private async Task<string> ResolvePrimaryProductNameAsync(IEnumerable<CreateSupplierOrderItemDto> items)
        {
            var firstProductId = items?
                .Select(x => (Guid?)x.ProductId)
                .FirstOrDefault(x => x.HasValue && x.Value != Guid.Empty);

            if (firstProductId == null || firstProductId == Guid.Empty)
            {
                return string.Empty;
            }

            return await ResolveProductNameByIdAsync(firstProductId.Value);
        }

        private async Task<string> ResolvePrimaryProductNameAsync(SupplierOrder order)
        {
            var itemWithName = order?.Items?.FirstOrDefault(x => x?.Product != null && !string.IsNullOrWhiteSpace(x.Product.Name));
            if (itemWithName?.Product != null)
            {
                return itemWithName.Product.Name;
            }

            var firstProductId = order?.Items?
                .Select(x => (Guid?)x.ProductId)
                .FirstOrDefault(x => x.HasValue && x.Value != Guid.Empty);

            if (firstProductId == null || firstProductId == Guid.Empty)
            {
                return string.Empty;
            }

            return await ResolveProductNameByIdAsync(firstProductId.Value);
        }

        private async Task<string> ResolveProductNameByIdAsync(Guid productId)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var product = await _productRepository.GetAll()
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(x => x.Id == productId);

                if (!string.IsNullOrWhiteSpace(product?.Name))
                {
                    return product.Name;
                }

                var storeProduct = await _storeProductRepository.GetAll()
                    .IgnoreQueryFilters()
                    .Include(x => x.Product)
                    .FirstOrDefaultAsync(x => x.Id == productId || x.ProductId == productId);

                if (!string.IsNullOrWhiteSpace(storeProduct?.Product?.Name))
                {
                    return storeProduct.Product.Name;
                }
            }

            return string.Empty;
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

        private static string NormalizeTrackingCode(string trackingCode, string productName)
        {
            var value = (trackingCode ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
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

        private async Task<string> EnsureUniqueTrackingCodeAsync(string preferred, string productName, Guid? orderId)
        {
            if (!string.IsNullOrWhiteSpace(preferred))
            {
                var exists = await _supplierOrderRepository.GetAll()
                    .IgnoreQueryFilters()
                    .AnyAsync(x => x.TrackingCode == preferred && (!orderId.HasValue || x.Id != orderId.Value));
                if (!exists)
                {
                    return preferred;
                }
            }

            return await GenerateUniqueTrackingCodeAsync(productName);
        }
    }
}
