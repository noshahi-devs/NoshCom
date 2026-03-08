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
        private readonly IRepository<AppTransaction, long> _appTransactionRepository;
        private readonly ISmartStoreWalletManager _smartStoreWalletManager;
        private readonly IWalletManager _walletManager;
        private readonly IEmailSender _emailSender;

        private const long PlatformAdminId = 1;

        public SupplierOrderAppService(
            IRepository<Elicom.Entities.SupplierOrder, Guid> supplierOrderRepository,
            IRepository<SupplierOrderItem, Guid> supplierOrderItemRepository,
            IRepository<StoreProduct, Guid> storeProductRepository,
            IRepository<AppTransaction, long> appTransactionRepository,
            ISmartStoreWalletManager smartStoreWalletManager,
            IWalletManager walletManager,
            IEmailSender emailSender)
        {
            _supplierOrderRepository = supplierOrderRepository;
            _supplierOrderItemRepository = supplierOrderItemRepository;
            _storeProductRepository = storeProductRepository;
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

            return new ListResultDto<SupplierOrderDto>(ObjectMapper.Map<List<SupplierOrderDto>>(orders));
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

            var supplierOrder = new SupplierOrder
            {
                ResellerId = user.Id, 
                SupplierId = adminId, 
                WarehouseAddress = input.WarehouseAddress,
                CustomerName = input.CustomerName,
                ShippingAddress = input.ShippingAddress,
                Status = "Pending", 
                ReferenceCode = GenerateReferenceCode(),
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

            return ObjectMapper.Map<SupplierOrderDto>(supplierOrder);
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

            return ObjectMapper.Map<SupplierOrderDto>(supplierOrder);
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
            order.TrackingCode = input.TrackingCode;

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
                return ObjectMapper.Map<SupplierOrderDto>(order);

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
            return ObjectMapper.Map<SupplierOrderDto>(order);
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

            return new ListResultDto<SupplierOrderDto>(ObjectMapper.Map<List<SupplierOrderDto>>(orders));
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
            
            return ObjectMapper.Map<SupplierOrderDto>(order);
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
    }
}
