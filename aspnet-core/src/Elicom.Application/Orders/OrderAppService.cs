using Abp.Application.Services;
using Abp.Domain.Repositories;
using Abp.UI;
using Elicom.Entities;
using Elicom.Wallets;
using Elicom.Orders.Dto;
using Elicom.SupplierOrders.Dto;
using Abp.Authorization;
using Elicom.Authorization;
using Elicom.Authorization.Users;
using Abp.Domain.Uow;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using Abp.Application.Services.Dto;
using Elicom.Cards;
using Abp.BackgroundJobs;
using Elicom.BackgroundJobs;
using Elicom.Orders.BackgroundJobs;
using Abp.Runtime.Session;

namespace Elicom.Orders
{
    public class OrderAppService : ElicomAppServiceBase, IOrderAppService
    {
        private readonly IRepository<Order, Guid> _orderRepository;
        private readonly IRepository<CartItem, Guid> _cartItemRepository;
        private readonly IRepository<OrderItem, Guid> _orderItemRepository;
        private readonly IRepository<SupplierOrder, Guid> _supplierOrderRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;
        private readonly IRepository<Carrier, int> _carrierRepository;
        private readonly IRepository<AppTransaction, long> _appTransactionRepository;
        private readonly IWalletManager _walletManager;
        private readonly ICardAppService _cardAppService;
        private readonly ISmartStoreWalletManager _smartStoreWalletManager;
        private readonly IBackgroundJobManager _backgroundJobManager;

        private const long PlatformAdminId = 1;
        private const string InternalOrderAlertEmail = "noshahidevelopersinc@gmail.com";

        public OrderAppService(
            IRepository<Order, Guid> orderRepository,
            IRepository<CartItem, Guid> cartItemRepository,
            IRepository<OrderItem, Guid> orderItemRepository,
            IRepository<SupplierOrder, Guid> supplierOrderRepository,
            IRepository<StoreProduct, Guid> storeProductRepository,
            IRepository<Carrier, int> carrierRepository,
            IRepository<AppTransaction, long> appTransactionRepository,
            IWalletManager walletManager,
            ICardAppService cardAppService,
            ISmartStoreWalletManager smartStoreWalletManager,
            IBackgroundJobManager backgroundJobManager)
        {
            _orderRepository = orderRepository;
            _cartItemRepository = cartItemRepository;
            _orderItemRepository = orderItemRepository;
            _supplierOrderRepository = supplierOrderRepository;
            _storeProductRepository = storeProductRepository;
            _carrierRepository = carrierRepository;
            _appTransactionRepository = appTransactionRepository;
            _walletManager = walletManager;
            _cardAppService = cardAppService;
            _smartStoreWalletManager = smartStoreWalletManager;
            _backgroundJobManager = backgroundJobManager;
        }

        public virtual async Task<OrderDto> Create(CreateOrderDto input)
        {
            var sessionUserId = AbpSession.UserId;
            var effectiveUserId = sessionUserId ?? input.UserId;

            if (effectiveUserId <= 0)
            {
                throw new UserFriendlyException("User session not found. Please log in again.");
            }

            if (sessionUserId.HasValue && input.UserId > 0 && input.UserId != sessionUserId.Value)
            {
                Logger.Warn($"[OrderAppService] Create Order user mismatch. SessionUserId={sessionUserId.Value}, PayloadUserId={input.UserId}. Using session user.");
            }

            Logger.Info($"[OrderAppService] Create Order for EffectiveUserId: {effectiveUserId}");
            
            List<CartItem> cartItems;
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                cartItems = await _cartItemRepository.GetAll()
                    .Include(ci => ci.StoreProduct).ThenInclude(sp => sp.Product)
                    .Include(ci => ci.StoreProduct).ThenInclude(sp => sp.Store)
                    .Where(ci => ci.UserId == effectiveUserId && ci.Status == "Active")
                    .ToListAsync();
            }

            if (!cartItems.Any())
                throw new UserFriendlyException("Cart is empty");

            User user;
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                user = await UserManager.Users
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(u => u.Id == effectiveUserId);
            }

            if (user == null)
                throw new UserFriendlyException("User not found.");

            var subTotal = cartItems.Sum(i => i.Price * i.Quantity);
            var totalAmount = subTotal + input.ShippingCost - input.Discount;

            var sourcePlatform = string.IsNullOrWhiteSpace(input.SourcePlatform)
                ? "SmartStore"
                : input.SourcePlatform.Trim();
            var isSmartStorePlatform = sourcePlatform.Equals("SmartStore", StringComparison.OrdinalIgnoreCase);
            var isPrimeShipPlatform = sourcePlatform.Equals("PrimeShip", StringComparison.OrdinalIgnoreCase);

            var paymentMethod = input.PaymentMethod?.Trim() ?? string.Empty;
            if (isPrimeShipPlatform && paymentMethod.Equals("card", StringComparison.OrdinalIgnoreCase))
            {
                // PrimeShip card purchases are routed through EasyFinora wallet-backed flow.
                paymentMethod = "finora";
            }

            var isExternalPayment = new[] { "finora", "mastercard", "discover", "amex", "visa", "bank_transfer", "crypto", "google_pay" }
                .Any(p => paymentMethod.Contains(p, StringComparison.OrdinalIgnoreCase));
            string paymentStatus = "Pending";

            if (paymentMethod.Equals("wallet", StringComparison.OrdinalIgnoreCase) || (isSmartStorePlatform && !isExternalPayment))
            {
                var balance = await _walletManager.GetBalanceAsync(user.Id);
                if (balance < totalAmount)
                {
                    throw new UserFriendlyException("Insufficient funds in Wallet to place this order.");
                }
                paymentStatus = "Held in Escrow";
            }
            else if (paymentMethod.Contains("finora", StringComparison.OrdinalIgnoreCase))
            {
                var validationResult = await _cardAppService.ValidateCard(new ValidateCardInput
                {
                    CardNumber = input.CardNumber,
                    Cvv = input.Cvv,
                    ExpiryDate = input.ExpiryDate,
                    Amount = totalAmount,
                    SourcePlatform = sourcePlatform
                });

                if (!validationResult.IsValid)
                {
                    throw new UserFriendlyException($"Finora Payment Failed: {validationResult.Message}");
                }

                await _cardAppService.ProcessPayment(new ProcessCardPaymentInput
                {
                    CardNumber = input.CardNumber,
                    Cvv = input.Cvv,
                    ExpiryDate = input.ExpiryDate,
                    Amount = totalAmount,
                    ReferenceId = $"CARD-ORD-{DateTime.Now:yyyyMMddHHmmss}",
                    SourcePlatform = sourcePlatform,
                    Description = BuildCardPurchaseDescription(sourcePlatform)
                });

                paymentStatus = "Paid (Easy Finora)";
            }
            else
            {
                paymentStatus = "Paid (External)";
            }

            if (paymentMethod.Equals("wallet", StringComparison.OrdinalIgnoreCase) || (isSmartStorePlatform && !isExternalPayment))
            {
                await _walletManager.TransferAsync(user.Id, PlatformAdminId, totalAmount, $"Escrow Hold for Orders {DateTime.Now:yyyyMMddHHmmss}");
            }
            else
            {
                // External payments should fund escrow (admin wallet) directly
                await _walletManager.DepositAsync(PlatformAdminId, totalAmount, $"ESC-{DateTime.Now:yyyyMMddHHmmss}", $"Escrow Hold for Orders {DateTime.Now:yyyyMMddHHmmss}");
            }
            var createdOrders = new List<Order>();
            var storeGroups = cartItems.GroupBy(ci => ci.StoreProduct.StoreId).ToList();
            decimal allocatedShipping = 0m;
            decimal allocatedDiscount = 0m;

            for (var i = 0; i < storeGroups.Count; i++)
            {
                var group = storeGroups[i];
                var isLast = i == storeGroups.Count - 1;
                var groupSubTotal = group.Sum(ci => ci.Price * ci.Quantity);

                decimal groupShipping;
                decimal groupDiscount;

                if (subTotal <= 0)
                {
                    groupShipping = 0;
                    groupDiscount = 0;
                }
                else
                {
                    groupShipping = isLast
                        ? input.ShippingCost - allocatedShipping
                        : Math.Round(input.ShippingCost * (groupSubTotal / subTotal), 2);
                    groupDiscount = isLast
                        ? input.Discount - allocatedDiscount
                        : Math.Round(input.Discount * (groupSubTotal / subTotal), 2);
                }

                allocatedShipping += groupShipping;
                allocatedDiscount += groupDiscount;

                var orderTotal = groupSubTotal + groupShipping - groupDiscount;
                var orderNumber = $"ORD-{DateTime.Now:yyyyMMddHHmmss}-{i + 1}";

                var order = new Order
                {
                    UserId = effectiveUserId,
                    OrderNumber = orderNumber,
                    PaymentMethod = paymentMethod,
                    ShippingAddress = input.ShippingAddress,
                    Country = input.Country,
                    State = input.State,
                    City = input.City,
                    PostalCode = input.PostalCode,
                    RecipientName = input.RecipientName,
                    RecipientPhone = input.RecipientPhone,
                    RecipientEmail = input.RecipientEmail,
                    SubTotal = groupSubTotal,
                    ShippingCost = groupShipping,
                    Discount = groupDiscount,
                    TotalAmount = orderTotal,
                    Status = "Pending",
                    PaymentStatus = paymentStatus,
                    SourcePlatform = sourcePlatform,
                    OrderItems = new List<OrderItem>()
                };

                order.Id = Guid.NewGuid();
                await _orderRepository.InsertAsync(order);
                createdOrders.Add(order);

                foreach (var ci in group)
                {
                    var orderItem = new OrderItem
                    {
                        OrderId = order.Id,
                        StoreProductId = ci.StoreProductId,
                        ProductId = ci.StoreProduct.ProductId,
                        Quantity = ci.Quantity,
                        PriceAtPurchase = ci.Price,
                        OriginalPrice = ci.OriginalPrice,
                        DiscountPercentage = ci.ResellerDiscountPercentage,
                        ProductName = ci.StoreProduct.Product.Name,
                        StoreName = ci.StoreProduct.Store.Name
                    };

                    await _orderItemRepository.InsertAsync(orderItem);
                    order.OrderItems.Add(orderItem);
                }

                foreach (var supplierGroup in group.GroupBy(ci => ci.StoreProduct.Product.SupplierId))
                {
                    var supplierId = supplierGroup.Key.GetValueOrDefault();
                    var storeOwnerId = supplierGroup.First().StoreProduct.Store.OwnerId;
                    var supplierOrder = new SupplierOrder
                    {
                        SupplierId = supplierId,
                        ResellerId = storeOwnerId,
                        OrderId = order.Id,
                        ReferenceCode = $"SUP-{DateTime.Now:yyyyMMddHHmmss}-{supplierId}",
                        Status = "Purchased",
                        TotalPurchaseAmount = supplierGroup.Sum(ci => ResolveSupplierPrice(ci.StoreProduct.Product) * ci.Quantity),
                        CustomerName = user.Name,
                        ShippingAddress = input.ShippingAddress,
                        SourcePlatform = order.SourcePlatform,
                        Items = new List<SupplierOrderItem>()
                    };

                    foreach (var ci in supplierGroup)
                    {
                        supplierOrder.Items.Add(new SupplierOrderItem
                        {
                            ProductId = ci.StoreProduct.ProductId,
                            Quantity = ci.Quantity,
                            PurchasePrice = ResolveSupplierPrice(ci.StoreProduct.Product)
                        });
                    }

                    await _supplierOrderRepository.InsertAsync(supplierOrder);
                }

                await _backgroundJobManager.EnqueueAsync<OrderEmailJob, OrderEmailJobArgs>(new OrderEmailJobArgs { OrderId = order.Id });
            }

            foreach (var ci in cartItems)
            {
                await _cartItemRepository.DeleteAsync(ci.Id);
            }

            return ObjectMapper.Map<OrderDto>(createdOrders.First());
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Admin, PermissionNames.Admin)]
        public virtual async Task<OrderDto> CreateManualOrder(CreateManualOrderDto input)
        {
            Logger.Info($"[OrderAppService] CreateManualOrder: Starting for StoreProductId={input.StoreProductId}, AdminId={AbpSession.UserId}");
            
            try 
            {
                var adminId = AbpSession.GetUserId();
                
                using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
                {
                    // 1. Fetch Store Product
                    var storeProduct = await _storeProductRepository.GetAll()
                        .Include(sp => sp.Product)
                        .Include(sp => sp.Store)
                        .FirstOrDefaultAsync(sp => sp.Id == input.StoreProductId);

                    if (storeProduct == null)
                        throw new UserFriendlyException($"Product not found in store (ID: {input.StoreProductId}). It might be disabled or in another tenant.");

                    // 2. Calculate Amounts
                    var price = input.OverridePrice ?? storeProduct.ResellerPrice;
                    var subTotal = price * input.Quantity;
                    var totalAmount = subTotal;

                    var orderNumber = $"MAN-{DateTime.Now:yyyyMMddHHmmss}";
                    var sourcePlatform = "WorldCart";

                    // 3. Create Order
                    var order = new Order
                    {
                        UserId = adminId,
                        OrderNumber = orderNumber,
                        PaymentMethod = "System Credit",
                        ShippingAddress = input.ShippingAddress,
                        Country = input.Country,
                        State = input.State,
                        City = input.City,
                        PostalCode = input.PostalCode,
                        RecipientName = input.RecipientName,
                        RecipientPhone = input.RecipientPhone,
                        RecipientEmail = input.RecipientEmail,
                        SubTotal = subTotal,
                        ShippingCost = 0,
                        Discount = 0,
                        TotalAmount = totalAmount,
                        Status = "Pending",
                        PaymentStatus = "Paid (System Credit)",
                        SourcePlatform = sourcePlatform,
                        OrderItems = new List<OrderItem>()
                    };

                    await _orderRepository.InsertAsync(order);
                    await CurrentUnitOfWork.SaveChangesAsync(); // Ensure ID is generated

                    // 4. Create Order Item
                    var orderItem = new OrderItem
                    {
                        OrderId = order.Id,
                        StoreProductId = storeProduct.Id,
                        ProductId = storeProduct.ProductId,
                        Quantity = input.Quantity,
                        PriceAtPurchase = price,
                        OriginalPrice = storeProduct.Product?.ResellerMaxPrice ?? 0,
                        DiscountPercentage = storeProduct.ResellerDiscountPercentage,
                        ProductName = storeProduct.Product?.Name ?? "Unknown Product",
                        StoreName = storeProduct.Store?.Name ?? "Unknown Store"
                    };

                    await _orderItemRepository.InsertAsync(orderItem);
                    order.OrderItems.Add(orderItem);

                    // 5. Create Supplier Order
                    var supplierId = storeProduct.Product?.SupplierId.GetValueOrDefault() ?? 0;
                    var supplierOrder = new SupplierOrder
                    {
                        SupplierId = supplierId,
                        ResellerId = storeProduct.Store?.OwnerId ?? 0,
                        OrderId = order.Id,
                        ReferenceCode = $"SUP-MAN-{DateTime.Now:yyyyMMddHHmmss}",
                        Status = "Purchased",
                        TotalPurchaseAmount = ResolveSupplierPrice(storeProduct.Product) * input.Quantity,
                        CustomerName = input.RecipientName,
                        ShippingAddress = input.ShippingAddress,
                        SourcePlatform = order.SourcePlatform,
                        Items = new List<SupplierOrderItem>()
                    };

                    supplierOrder.Items.Add(new SupplierOrderItem
                    {
                        ProductId = storeProduct.ProductId,
                        Quantity = input.Quantity,
                        PurchasePrice = ResolveSupplierPrice(storeProduct.Product)
                    });

                    await _supplierOrderRepository.InsertAsync(supplierOrder);

                    await _backgroundJobManager.EnqueueAsync<OrderEmailJob, OrderEmailJobArgs>(new OrderEmailJobArgs { OrderId = order.Id });

                    if (order.Id == Guid.Empty)
                    {
                         Logger.Warn("[OrderAppService] CreateManualOrder: ID is still empty after insert/sync!");
                    }

                    Logger.Info($"[OrderAppService] CreateManualOrder: Success. OrderId={order.Id}, OrderNumber={order.OrderNumber}");
                    return ObjectMapper.Map<OrderDto>(order);
                }
            }
            catch (UserFriendlyException) { throw; }
            catch (Exception ex)
            {
                Logger.Error($"[OrderAppService] CreateManualOrder: FAILED. Error={ex.Message}", ex);
                throw new UserFriendlyException($"Manual Order Failed: {ex.Message}. Details: {ex.InnerException?.Message}");
            }
        }

        [AbpAuthorize]
        public virtual async Task<OrderDto> Get(Guid id)
        {
            return await GetOrderInternal(id, null);
        }

        [AbpAuthorize]
        public virtual async Task<OrderDto> GetByOrderNumber(string orderNumber)
        {
            return await GetOrderInternal(null, orderNumber);
        }

        private async Task<OrderDto> GetOrderInternal(Guid? id, string orderNumber)
        {
            var userId = AbpSession.UserId;
            var isSeller = await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_SmartStore_Seller);
            var isAdmin = await IsCurrentUserAdminAsync();

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                IQueryable<Order> query = _orderRepository.GetAll()
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.StoreProduct).ThenInclude(sp => sp.Product)
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.StoreProduct).ThenInclude(sp => sp.Store).ThenInclude(s => s.Owner);

                Order order;
                if (id.HasValue)
                {
                    order = await query.FirstOrDefaultAsync(o => o.Id == id.Value);
                }
                else
                {
                    order = await query.FirstOrDefaultAsync(o => o.OrderNumber == orderNumber);
                }

                if (order == null) return null;

                if (order.OrderItems == null || !order.OrderItems.Any())
                {
                    var items = await _orderItemRepository.GetAll()
                        .Include(oi => oi.StoreProduct).ThenInclude(sp => sp.Product)
                        .Include(oi => oi.StoreProduct).ThenInclude(sp => sp.Store).ThenInclude(s => s.Owner)
                        .Where(oi => oi.OrderId == order.Id)
                        .ToListAsync();

                    order.OrderItems = items;
                }

                var orderDto = ObjectMapper.Map<OrderDto>(order);
                PopulateSellerAndSourceMeta(orderDto, order);

                if (!isAdmin)
                {
                    if (!userId.HasValue)
                    {
                        throw new UserFriendlyException("Unauthorized request.");
                    }

                    var isOrderOwner = order.UserId == userId.Value;
                    var myOrderItemIds = order.OrderItems
                        .Where(oi => oi.StoreProduct?.Store?.OwnerId == userId)
                        .Select(oi => oi.Id).ToList();
                    var canAccessAsSeller = isSeller && myOrderItemIds.Any();

                    if (!isOrderOwner && !canAccessAsSeller)
                    {
                        throw new UserFriendlyException("You are not authorized to view this order.");
                    }

                    if (!isOrderOwner && canAccessAsSeller)
                    {
                        orderDto.OrderItems = orderDto.OrderItems
                            .Where(oi => myOrderItemIds.Contains(oi.Id)).ToList();

                        AdjustTotalsForSeller(orderDto, order);
                    }
                }

                return orderDto;
            }
        }

        public virtual async Task<List<OrderDto>> GetAll()
        {
            var userId = AbpSession.UserId;
            var isSeller = await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_SmartStore_Seller);
            var isAdmin = await IsCurrentUserAdminAsync();

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                IQueryable<Order> query = _orderRepository.GetAll()
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.StoreProduct).ThenInclude(sp => sp.Product)
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.StoreProduct).ThenInclude(sp => sp.Store);

                if (isSeller && !isAdmin)
                {
                    query = query.Where(o => o.OrderItems.Any(oi => oi.StoreProduct.Store.OwnerId == userId));
                }

                var orders = await query.OrderByDescending(o => o.CreationTime).ToListAsync();
                var orderDtos = ObjectMapper.Map<List<OrderDto>>(orders);

                if (isSeller && !isAdmin)
                {
                    foreach (var orderDto in orderDtos)
                    {
                        if (orderDto.UserId != userId)
                        {
                            var originalOrder = orders.First(o => o.Id == orderDto.Id);
                            var myOrderItemIds = originalOrder.OrderItems
                                .Where(oi => oi.StoreProduct?.Store?.OwnerId == userId)
                                .Select(oi => oi.Id).ToList();

                            orderDto.OrderItems = orderDto.OrderItems
                                .Where(oi => myOrderItemIds.Contains(oi.Id)).ToList();

                            AdjustTotalsForSeller(orderDto, originalOrder);
                        }
                    }
                }

                return orderDtos;
            }
        }

        [AbpAuthorize(PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_SmartStore_Admin)]
        public virtual async Task<List<OrderDto>> GetAllForCustomer(long userId)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var orders = await _orderRepository.GetAll()
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.StoreProduct).ThenInclude(sp => sp.Product)
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.StoreProduct).ThenInclude(sp => sp.Store)
                    .Where(o => o.UserId == userId)
                    .ToListAsync();

                return ObjectMapper.Map<List<OrderDto>>(orders);
            }
        }

        [AbpAuthorize]
        public virtual async Task<PagedResultDto<OrderListItemDto>> GetForCustomer(GetCustomerOrdersInput input)
        {
            var userId = AbpSession.GetUserId();

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var query = _orderRepository.GetAll()
                    .AsNoTracking()
                    .Where(o => o.UserId == userId);

                if (!string.IsNullOrWhiteSpace(input.Status))
                {
                    var status = input.Status.Trim();
                    if (status.Equals("Return", StringComparison.OrdinalIgnoreCase) ||
                        status.Equals("Returned", StringComparison.OrdinalIgnoreCase) ||
                        status.Equals("Refund/Return", StringComparison.OrdinalIgnoreCase))
                    {
                        query = query.Where(o => o.Status == "Return" || o.Status == "Returned" || o.Status == "Refund/Return");
                    }
                    else
                    {
                        query = query.Where(o => o.Status == status);
                    }
                }

                var totalCount = await query.CountAsync();
                var items = await query
                    .OrderByDescending(o => o.CreationTime)
                    .Skip(input.SkipCount)
                    .Take(input.MaxResultCount)
                    .Select(o => new OrderListItemDto
                    {
                        Id = o.Id,
                        OrderNumber = o.OrderNumber,
                        CreationTime = o.CreationTime,
                        TotalAmount = o.TotalAmount,
                        Status = o.Status,
                        PaymentStatus = o.PaymentStatus,
                        ProductName = o.OrderItems
                            .OrderBy(oi => oi.Id)
                            .Select(oi => oi.ProductName ?? oi.StoreProduct.Product.Name)
                            .FirstOrDefault(),
                        StoreName = o.OrderItems
                            .OrderBy(oi => oi.Id)
                            .Select(oi => oi.StoreName ?? oi.StoreProduct.Store.Name)
                            .FirstOrDefault()
                    })
                    .ToListAsync();

                return new PagedResultDto<OrderListItemDto>(totalCount, items);
            }
        }

        [AbpAuthorize(PermissionNames.Pages_SmartStore_Seller)]
        public virtual async Task<List<OrderDto>> GetByStore(Guid storeId)
        {
            var userId = AbpSession.UserId;
            var isAdmin = await IsCurrentUserAdminAsync();

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var orders = await _orderRepository.GetAll()
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.StoreProduct).ThenInclude(sp => sp.Product)
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.StoreProduct).ThenInclude(sp => sp.Store)
                    .Where(o => o.OrderItems.Any(oi => oi.StoreProduct.StoreId == storeId))
                    .OrderByDescending(o => o.CreationTime)
                    .ToListAsync();

                var orderDtos = ObjectMapper.Map<List<OrderDto>>(orders);

                if (!isAdmin)
                {
                    foreach (var orderDto in orderDtos)
                    {
                        var originalOrder = orders.First(o => o.Id == orderDto.Id);
                        orderDto.OrderItems = orderDto.OrderItems
                            .Where(oi => originalOrder.OrderItems.Any(item => item.Id == oi.Id && item.StoreProduct.StoreId == storeId))
                            .ToList();

                        AdjustTotalsForSeller(orderDto, originalOrder);
                    }
                }

                return orderDtos;
            }
        }

        [AbpAuthorize(PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_SmartStore_Seller, PermissionNames.Pages_SmartStore_Admin)]
        public async Task<OrderDto> Fulfill(FulfillOrderDto input)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var query = _orderRepository.GetAll()
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.StoreProduct);

                Order order = null;
                if (Guid.TryParse(input.Id, out Guid guidId))
                {
                    order = await query.FirstOrDefaultAsync(o => o.Id == guidId);
                }
                
                if (order == null)
                {
                    order = await query.FirstOrDefaultAsync(o => o.OrderNumber == input.Id);
                }

                if (order == null) throw new UserFriendlyException("Order not found");
                if (string.Equals(order.Status, "Rejected", StringComparison.OrdinalIgnoreCase))
                    throw new UserFriendlyException("Rejected order cannot be shipped again.");
                if (string.Equals(order.Status, "Delivered", StringComparison.OrdinalIgnoreCase))
                    throw new UserFriendlyException("Delivered order cannot be shipped again.");
                if (string.Equals(order.Status, "Verified", StringComparison.OrdinalIgnoreCase))
                    throw new UserFriendlyException("Verified order cannot be shipped again.");
                if (string.Equals(order.Status, "Shipped", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(order.Status, "ShippedFromHub", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(order.Status, "PendingVerification", StringComparison.OrdinalIgnoreCase))
                    throw new UserFriendlyException("Order is already in shipping flow.");

                var userId = AbpSession.GetUserId();
                var isSeller = await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_SmartStore_Seller);
                var isAdmin = await IsCurrentUserAdminAsync();

                if (isSeller && !isAdmin)
                {
                    var sellerStores = await _storeProductRepository.GetAll()
                        .Include(sp => sp.Store).Where(sp => sp.Store.OwnerId == userId)
                        .Select(sp => sp.StoreId).Distinct().ToListAsync();

                    var orderStoreIds = order.OrderItems.Select(oi => oi.StoreProduct.StoreId).Distinct().ToList();

                    if (!sellerStores.Intersect(orderStoreIds).Any())
                    {
                        throw new UserFriendlyException("Unauthorized: This order does not contain items from your store.");
                    }

                    order.Status = "Shipped";
                }
                else
                {
                    var subOrders = await _supplierOrderRepository.GetAll()
                        .Where(so => so.OrderId == order.Id).ToListAsync();

                    if (subOrders.Any(so => so.Status != "Verified"))
                        throw new UserFriendlyException("All items must be verified at the Hub before final delivery.");

                    order.Status = "ShippedFromHub";
                }

                order.ShipmentDate = input.ShipmentDate;
                order.CarrierId = input.CarrierId;
                order.TrackingCode = input.TrackingCode;

                await _orderRepository.UpdateAsync(order);
                await TryQueueShipmentEmailAsync(order);
                return ObjectMapper.Map<OrderDto>(order);
            }
        }

        [AbpAuthorize(PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_SmartStore_Admin, PermissionNames.Admin, PermissionNames.Pages_Users)]
        public async Task<OrderDto> Verify(VerifyOrderDto input)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                if (string.IsNullOrWhiteSpace(input?.Id))
                    throw new UserFriendlyException("Order not found");

                Order order = null;
                if (Guid.TryParse(input.Id, out var guidId))
                {
                    order = await _orderRepository.FirstOrDefaultAsync(guidId);
                }

                if (order == null)
                {
                    order = await _orderRepository.GetAll().FirstOrDefaultAsync(o => o.OrderNumber == input.Id);
                }

                if (order == null) throw new UserFriendlyException("Order not found");

                if (string.Equals(order.Status, "Delivered", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(order.Status, "Verified", StringComparison.OrdinalIgnoreCase))
                {
                    return ObjectMapper.Map<OrderDto>(order);
                }

                if (!IsVerifyCandidateStatus(order.Status))
                    throw new UserFriendlyException("Only shipped orders can be verified.");

                order.Status = "Verified";

                await _orderRepository.UpdateAsync(order);
                await TryQueueOrderVerifiedEmailAsync(order);
                return ObjectMapper.Map<OrderDto>(order);
            }
        }

        [AbpAuthorize(PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_SmartStore_Admin, PermissionNames.Admin, PermissionNames.Pages_Users)]
        public async Task<OrderDto> Deliver(VerifyOrderDto input)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                if (string.IsNullOrWhiteSpace(input?.Id))
                    throw new UserFriendlyException("Order not found");

                Order order = null;
                if (Guid.TryParse(input.Id, out var guidId))
                {
                    order = await _orderRepository.FirstOrDefaultAsync(guidId);
                }

                if (order == null)
                {
                    order = await _orderRepository.GetAll().FirstOrDefaultAsync(o => o.OrderNumber == input.Id);
                }

                if (order == null) throw new UserFriendlyException("Order not found");

                if (string.Equals(order.Status, "Delivered", StringComparison.OrdinalIgnoreCase))
                    return ObjectMapper.Map<OrderDto>(order);

                if (!IsDeliverableStatus(order.Status))
                    throw new UserFriendlyException("Order must be Verified or Shipped before it can be marked as Delivered");

                order.Status = "Delivered";
                order.PaymentStatus = "Completed";

                var pendingTransactions = await _appTransactionRepository.GetAll()
                    .Where(t => t.OrderId == order.Id && t.Status == "Pending").ToListAsync();

                foreach (var trans in pendingTransactions)
                {
                    trans.Status = "Approved";
                    await _walletManager.DepositAsync(trans.UserId, trans.Amount, trans.ReferenceId, $"Payment Release: {trans.Description}");
                }

                await _orderRepository.UpdateAsync(order);
                await FinalizeOrder(order);
                await TryQueueOrderDeliveredEmailAsync(order);
                return ObjectMapper.Map<OrderDto>(order);
            }
        }

        public async Task<OrderDto> Cancel(VerifyOrderDto input)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                if (string.IsNullOrWhiteSpace(input?.Id))
                    throw new UserFriendlyException("Order not found");

                Order order = null;
                if (Guid.TryParse(input.Id, out var guidId))
                {
                    order = await _orderRepository.FirstOrDefaultAsync(guidId);
                }

                if (order == null)
                {
                    order = await _orderRepository.GetAll().FirstOrDefaultAsync(o => o.OrderNumber == input.Id);
                }

                if (order == null) throw new UserFriendlyException("Order not found");

                if (order.Status == "Delivered" || order.Status == "Cancelled" || order.Status == "Rejected")
                    throw new UserFriendlyException($"Cannot cancel an order that is already {order.Status}");

                if (order.PaymentStatus == "Held in Escrow")
                {
                    await _walletManager.TransferAsync(PlatformAdminId, order.UserId, order.TotalAmount, $"Refund for Order {order.OrderNumber}");
                    order.PaymentStatus = "Refunded (Escrow)";
                }
                else if (order.PaymentStatus == "Paid (Easy Finora)")
                {
                    await _cardAppService.RefundPayment(order.UserId, order.TotalAmount, order.OrderNumber, $"Refund for Order {order.OrderNumber}");
                    order.PaymentStatus = "Refunded (Easy Finora)";
                }

                order.Status = "Cancelled";
                await _orderRepository.UpdateAsync(order);
                return ObjectMapper.Map<OrderDto>(order);
            }
        }

        [AbpAuthorize(PermissionNames.Pages_PrimeShip_Admin, PermissionNames.Pages_SmartStore_Seller, PermissionNames.Pages_SmartStore_Admin)]
        public async Task<OrderDto> Reject(VerifyOrderDto input)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                if (string.IsNullOrWhiteSpace(input?.Id))
                    throw new UserFriendlyException("Order not found");

                Order order = null;
                if (Guid.TryParse(input.Id, out var guidId))
                {
                    order = await _orderRepository.FirstOrDefaultAsync(guidId);
                }

                if (order == null)
                {
                    order = await _orderRepository.GetAll().FirstOrDefaultAsync(o => o.OrderNumber == input.Id);
                }

                if (order == null)
                    throw new UserFriendlyException("Order not found");

                if (string.Equals(order.Status, "Delivered", StringComparison.OrdinalIgnoreCase))
                    throw new UserFriendlyException("Delivered order cannot be rejected.");

                if (string.Equals(order.Status, "Rejected", StringComparison.OrdinalIgnoreCase))
                    throw new UserFriendlyException("Order is already rejected.");

                order.Status = "Rejected";
                await _orderRepository.UpdateAsync(order);
                return ObjectMapper.Map<OrderDto>(order);
            }
        }

        public async Task<List<CarrierDto>> GetCarriers()
        {
            var carriers = await _carrierRepository.GetAll().Where(c => c.IsActive).ToListAsync();
            return ObjectMapper.Map<List<CarrierDto>>(carriers);
        }

        private static string BuildCardPurchaseDescription(string sourcePlatform)
        {
            var platformLabel = NormalizePlatformLabel(sourcePlatform);
            return string.IsNullOrWhiteSpace(platformLabel)
                ? "Easy Finora Card Payment"
                : $"{platformLabel} product purchase via Easy Finora Card";
        }

        private static decimal ResolveSupplierPrice(Product product)
        {
            if (product == null) return 0m;

            var resellerMaxPrice = Math.Max(0m, product.ResellerMaxPrice);
            var discountPercentage = Math.Clamp(product.DiscountPercentage, 0m, 100m);
            var discounted = resellerMaxPrice - (resellerMaxPrice * discountPercentage / 100m);

            if (discounted > 0m || resellerMaxPrice > 0m)
            {
                return Math.Round(Math.Max(discounted, 0m), 2, MidpointRounding.AwayFromZero);
            }

            return Math.Round(Math.Max(product.SupplierPrice, 0m), 2, MidpointRounding.AwayFromZero);
        }

        private static string NormalizePlatformLabel(string sourcePlatform)
        {
            if (string.IsNullOrWhiteSpace(sourcePlatform))
            {
                return null;
            }

            var normalized = sourcePlatform.Trim();
            if (normalized.Equals("PrimeShip", StringComparison.OrdinalIgnoreCase)) return "PrimeShip";
            if (normalized.Equals("SmartStore", StringComparison.OrdinalIgnoreCase)) return "SmartStore";
            if (normalized.Equals("WorldCart", StringComparison.OrdinalIgnoreCase)) return "WorldCart";

            return normalized;
        }

        private static bool IsVerifyCandidateStatus(string status)
        {
            if (string.IsNullOrWhiteSpace(status)) return false;

            return status.Equals("PendingVerification", StringComparison.OrdinalIgnoreCase)
                || status.Equals("Shipped", StringComparison.OrdinalIgnoreCase)
                || status.Equals("ShippedFromHub", StringComparison.OrdinalIgnoreCase)
                || status.Equals("Pending", StringComparison.OrdinalIgnoreCase)
                || status.Equals("Processing", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsDeliverableStatus(string status)
        {
            if (string.IsNullOrWhiteSpace(status)) return false;

            return status.Equals("Verified", StringComparison.OrdinalIgnoreCase)
                || status.Equals("ShippedFromHub", StringComparison.OrdinalIgnoreCase)
                || status.Equals("Shipped", StringComparison.OrdinalIgnoreCase);
        }

        private async Task<bool> IsCurrentUserAdminAsync()
        {
            return await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_PrimeShip_Admin)
                || await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_SmartStore_Admin)
                || await PermissionChecker.IsGrantedAsync(PermissionNames.Pages_Users)
                || await PermissionChecker.IsGrantedAsync(PermissionNames.Admin);
        }

        private static void AdjustTotalsForSeller(OrderDto dto, Order originalOrder)
        {
            if (dto?.OrderItems == null || originalOrder == null) return;

            var mySubTotal = dto.OrderItems.Sum(oi => oi.PriceAtPurchase * oi.Quantity);
            if (mySubTotal <= 0)
            {
                dto.SubTotal = 0;
                dto.ShippingCost = 0;
                dto.Discount = 0;
                dto.TotalAmount = 0;
                return;
            }

            var baseSubTotal = originalOrder.SubTotal <= 0 ? mySubTotal : originalOrder.SubTotal;
            var ratio = baseSubTotal <= 0 ? 1m : (mySubTotal / baseSubTotal);

            var myShipping = Math.Round(originalOrder.ShippingCost * ratio, 2);
            var myDiscount = Math.Round(originalOrder.Discount * ratio, 2);

            dto.SubTotal = mySubTotal;
            dto.ShippingCost = myShipping;
            dto.Discount = myDiscount;
            dto.TotalAmount = mySubTotal + myShipping - myDiscount;
        }

        private static void PopulateSellerAndSourceMeta(OrderDto dto, Order order)
        {
            if (dto == null || order == null)
            {
                return;
            }

            var firstOrderItem = order.OrderItems?.FirstOrDefault();
            var store = firstOrderItem?.StoreProduct?.Store;
            var owner = store?.Owner;

            dto.SellerStoreId = store?.Id;
            dto.SellerStoreName = store?.Name ?? firstOrderItem?.StoreName;
            dto.SellerId = store?.OwnerId;
            dto.SellerName = owner == null
                ? null
                : string.Join(" ", new[] { owner.Name, owner.Surname }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim();
            dto.SellerEmail = owner?.EmailAddress;

            dto.PrimeShipOrderId = string.IsNullOrWhiteSpace(order.SupplierReference)
                ? order.OrderNumber
                : order.SupplierReference;
            dto.PrimeShipTrackingNumber = !string.IsNullOrWhiteSpace(order.TrackingCode)
                ? order.TrackingCode
                : order.DeliveryTrackingNumber;
            dto.PrimeShipPurchasedAt = order.CreationTime;
        }

        private async Task TryQueueShipmentEmailAsync(Order order)
        {
            try
            {
                var customer = await FindUserByIdAsync(order.UserId);
                var customerEmail = customer?.EmailAddress;

                var branding = ResolveOrderBranding(order.SourcePlatform);
                var subject = $"Your Order Has Been Shipped - {branding.PlatformName}";
                var heading = string.Equals(order.Status, "ShippedFromHub", StringComparison.OrdinalIgnoreCase)
                    ? "Your Order Left the Hub"
                    : "Your Order Has Been Shipped";
                var message = "Great news. Your package is now in transit and will arrive soon.";

                var facts = new List<(string Label, string Value)>
                {
                    ("Order Number", order.OrderNumber),
                    ("Shipment Date", order.ShipmentDate?.ToString("MM-dd-yyyy") ?? DateTime.UtcNow.ToString("MM-dd-yyyy")),
                    ("Tracking Number", string.IsNullOrWhiteSpace(order.TrackingCode) ? "Will be shared shortly" : order.TrackingCode),
                    ("Payment Status", string.IsNullOrWhiteSpace(order.PaymentStatus) ? "Pending" : order.PaymentStatus),
                    ("Delivery Address", FormatOrderAddress(order))
                };

                if (!string.IsNullOrWhiteSpace(customerEmail))
                {
                    await QueueOrderLifecycleEmailAsync(order, customerEmail, subject, heading, message, facts);
                }

                await TryQueueShipmentAdminAlertEmailAsync(order, customerEmail);
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Order/Fulfill] Could not enqueue shipment email for order {order?.OrderNumber}: {ex.Message}");
            }
        }

        private async Task TryQueueShipmentAdminAlertEmailAsync(Order order, string customerEmail)
        {
            try
            {
                var adminEmail = ResolveInternalOrderAlertEmail(order?.SourcePlatform);
                if (string.IsNullOrWhiteSpace(adminEmail))
                {
                    return;
                }

                var branding = ResolveOrderBranding(order?.SourcePlatform);
                var subject = $"[ALERT] Order Shipped - {branding.PlatformName} - {order?.OrderNumber}";
                var heading = "Order Shipped (Internal Notification)";
                var message = "A shipment update was posted. Please review tracking and order progress.";
                var facts = new List<(string Label, string Value)>
                {
                    ("Order Number", order?.OrderNumber ?? "-"),
                    ("Order Status", order?.Status ?? "-"),
                    ("Shipment Date", order?.ShipmentDate?.ToString("MM-dd-yyyy") ?? DateTime.UtcNow.ToString("MM-dd-yyyy")),
                    ("Tracking Number", string.IsNullOrWhiteSpace(order?.TrackingCode) ? "Will be shared shortly" : order.TrackingCode),
                    ("Platform", branding.PlatformName),
                    ("Customer Email", string.IsNullOrWhiteSpace(customerEmail) ? (order?.RecipientEmail ?? "-") : customerEmail)
                };

                await QueueOrderLifecycleEmailAsync(order, adminEmail, subject, heading, message, facts);
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Order/Fulfill] Could not enqueue internal shipment alert for order {order?.OrderNumber}: {ex.Message}");
            }
        }

        private async Task TryQueueOrderVerifiedEmailAsync(Order order)
        {
            try
            {
                var customer = await FindUserByIdAsync(order.UserId);
                var customerEmail = customer?.EmailAddress;
                var sellerRecipients = await FindSellerRecipientsAsync(order.Id);

                var branding = ResolveOrderBranding(order.SourcePlatform);
                var subject = $"Order Verified - {branding.PlatformName}";
                var customerHeading = "Your Order Has Been Verified";
                var customerMessage = "Our admin team has verified your order. Delivery is now the next step.";

                var facts = new List<(string Label, string Value)>
                {
                    ("Order Number", order.OrderNumber),
                    ("Order Status", order.Status),
                    ("Payment Status", string.IsNullOrWhiteSpace(order.PaymentStatus) ? "Pending" : order.PaymentStatus),
                    ("Order Total", order.TotalAmount.ToString("C", CultureInfo.GetCultureInfo("en-US")))
                };

                if (!string.IsNullOrWhiteSpace(customerEmail))
                {
                    await QueueOrderLifecycleEmailAsync(order, customerEmail, subject, customerHeading, customerMessage, facts);
                }

                var sellerHeading = "Order Verified (Seller Update)";
                var sellerMessage = "An order containing your items has been verified by admin. Delivery progression is active.";
                foreach (var seller in sellerRecipients)
                {
                    if (string.IsNullOrWhiteSpace(seller.EmailAddress))
                    {
                        continue;
                    }

                    var sellerFacts = new List<(string Label, string Value)>
                    {
                        ("Order Number", order.OrderNumber),
                        ("Order Status", order.Status),
                        ("Payment Status", string.IsNullOrWhiteSpace(order.PaymentStatus) ? "Pending" : order.PaymentStatus),
                        ("Your Store(s)", string.IsNullOrWhiteSpace(seller.StoreNames) ? "-" : seller.StoreNames)
                    };

                    await QueueOrderLifecycleEmailAsync(order, seller.EmailAddress, subject, sellerHeading, sellerMessage, sellerFacts);
                }
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Order/Verify] Could not enqueue verified email for order {order?.OrderNumber}: {ex.Message}");
            }
        }

        private async Task TryQueueOrderDeliveredEmailAsync(Order order)
        {
            try
            {
                var customer = await FindUserByIdAsync(order.UserId);
                var customerEmail = customer?.EmailAddress;
                var sellerRecipients = await FindSellerRecipientsAsync(order.Id);

                var branding = ResolveOrderBranding(order.SourcePlatform);
                var subject = $"Order Delivered - {branding.PlatformName}";
                var customerHeading = "Order Delivered Successfully";
                var customerMessage = "Your order has been marked as delivered. Thank you for shopping with us.";

                var facts = new List<(string Label, string Value)>
                {
                    ("Order Number", order.OrderNumber),
                    ("Delivery Status", order.Status),
                    ("Payment Status", string.IsNullOrWhiteSpace(order.PaymentStatus) ? "Completed" : order.PaymentStatus),
                    ("Order Total", order.TotalAmount.ToString("C", CultureInfo.GetCultureInfo("en-US")))
                };

                if (!string.IsNullOrWhiteSpace(customerEmail))
                {
                    await QueueOrderLifecycleEmailAsync(order, customerEmail, subject, customerHeading, customerMessage, facts);
                }

                var sellerHeading = "Order Delivered (Seller Update)";
                var sellerMessage = "An order containing your items has been delivered. Settlement has been completed as per payout policy.";
                foreach (var seller in sellerRecipients)
                {
                    if (string.IsNullOrWhiteSpace(seller.EmailAddress))
                    {
                        continue;
                    }

                    var sellerFacts = new List<(string Label, string Value)>
                    {
                        ("Order Number", order.OrderNumber),
                        ("Delivery Status", order.Status),
                        ("Payment Status", string.IsNullOrWhiteSpace(order.PaymentStatus) ? "Completed" : order.PaymentStatus),
                        ("Your Store(s)", string.IsNullOrWhiteSpace(seller.StoreNames) ? "-" : seller.StoreNames)
                    };

                    await QueueOrderLifecycleEmailAsync(order, seller.EmailAddress, subject, sellerHeading, sellerMessage, sellerFacts);
                }
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Order/Deliver] Could not enqueue delivered email for order {order?.OrderNumber}: {ex.Message}");
            }
        }

        private async Task TryQueueSellerPayoutEmailAsync(Order order, long sellerUserId, decimal grossAmount, decimal platformFee, decimal netAmount)
        {
            try
            {
                var seller = await FindUserByIdAsync(sellerUserId);
                if (seller == null || string.IsNullOrWhiteSpace(seller.EmailAddress))
                {
                    return;
                }

                var branding = ResolveOrderBranding(order.SourcePlatform);
                var subject = $"Payout Released to Your Wallet - {branding.PlatformName}";
                var heading = "Seller Payout Released";
                var message = "Your order earnings have been settled and credited to your wallet after platform deduction.";

                var us = CultureInfo.GetCultureInfo("en-US");
                var facts = new List<(string Label, string Value)>
                {
                    ("Order Number", order.OrderNumber),
                    ("Gross Amount", grossAmount.ToString("C", us)),
                    ("Platform Fee (8%)", platformFee.ToString("C", us)),
                    ("Net Credited", netAmount.ToString("C", us)),
                    ("Settlement Status", "Completed")
                };

                await QueueOrderLifecycleEmailAsync(order, seller.EmailAddress, subject, heading, message, facts);
            }
            catch (Exception ex)
            {
                Logger.Warn($"[Order/Payout] Could not enqueue payout email for seller {sellerUserId}, order {order?.OrderNumber}: {ex.Message}");
            }
        }

        private async Task QueueOrderLifecycleEmailAsync(
            Order order,
            string to,
            string subject,
            string heading,
            string message,
            IReadOnlyCollection<(string Label, string Value)> facts)
        {
            if (order == null || string.IsNullOrWhiteSpace(to) || string.IsNullOrWhiteSpace(subject))
            {
                return;
            }

            var branding = ResolveOrderBranding(order.SourcePlatform);
            var body = BuildOrderLifecycleEmailBody(
                branding.PlatformName,
                branding.BrandColor,
                branding.SupportEmail,
                branding.FooterBrand,
                branding.FooterCompany,
                heading,
                message,
                facts);

            await _backgroundJobManager.EnqueueAsync<PlatformEmailJob, PlatformEmailJobArgs>(
                new PlatformEmailJobArgs
                {
                    PlatformName = branding.PlatformName,
                    To = to,
                    Subject = subject,
                    HtmlBody = body
                });
        }

        private async Task<User> FindUserByIdAsync(long userId)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                return await UserManager.Users
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(u => u.Id == userId);
            }
        }

        private async Task<List<SellerRecipientInfo>> FindSellerRecipientsAsync(Guid orderId)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var ownerStores = await _orderItemRepository.GetAll()
                    .Include(oi => oi.StoreProduct)
                        .ThenInclude(sp => sp.Store)
                    .Where(oi =>
                        oi.OrderId == orderId &&
                        oi.StoreProduct != null &&
                        oi.StoreProduct.Store != null)
                    .Select(oi => new
                    {
                        OwnerId = oi.StoreProduct.Store.OwnerId,
                        StoreName = oi.StoreProduct.Store.Name
                    })
                    .ToListAsync();

                var groupedByOwner = ownerStores
                    .GroupBy(x => x.OwnerId)
                    .ToList();

                var recipients = new List<SellerRecipientInfo>();
                foreach (var group in groupedByOwner)
                {
                    var seller = await FindUserByIdAsync(group.Key);
                    if (seller == null || string.IsNullOrWhiteSpace(seller.EmailAddress))
                    {
                        continue;
                    }

                    var storeNames = string.Join(", ", group
                        .Select(x => x.StoreName)
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Distinct());

                    recipients.Add(new SellerRecipientInfo
                    {
                        UserId = seller.Id,
                        EmailAddress = seller.EmailAddress,
                        StoreNames = storeNames
                    });
                }

                return recipients;
            }
        }

        private static (string PlatformName, string BrandColor, string SupportEmail, string FooterBrand, string FooterCompany) ResolveOrderBranding(string sourcePlatform)
        {
            if (!string.IsNullOrWhiteSpace(sourcePlatform) &&
                sourcePlatform.Contains("Prime", StringComparison.OrdinalIgnoreCase))
            {
                return ("Prime Ship UK", "#f85606", "support@primeshipuk.com", "PRIME SHIP UK", "Prime Ship UK");
            }

            if (!string.IsNullOrWhiteSpace(sourcePlatform) &&
                (sourcePlatform.Contains("Finora", StringComparison.OrdinalIgnoreCase) ||
                 sourcePlatform.Contains("Easy", StringComparison.OrdinalIgnoreCase)))
            {
                return ("Easy Finora", "#28a745", "support@easyfinora.com", "EASY FINORA", "Easy Finora");
            }

            // SmartStore in this deployment is World Cart customer platform.
            return ("World Cart", "#000000", "info@worldcartus.com.", "WORLD CART US", "World Cart Inc.");
        }

        private static string ResolveInternalOrderAlertEmail(string sourcePlatform)
        {
            return InternalOrderAlertEmail;
        }

        private static string BuildOrderLifecycleEmailBody(
            string platformName,
            string brandColor,
            string supportEmail,
            string footerBrand,
            string footerCompany,
            string heading,
            string message,
            IReadOnlyCollection<(string Label, string Value)> facts)
        {
            var factsHtml = new StringBuilder();
            if (facts != null)
            {
                foreach (var (label, value) in facts)
                {
                    if (string.IsNullOrWhiteSpace(label))
                    {
                        continue;
                    }

                    factsHtml.Append($@"
                        <div class='fact-row'>
                            <span class='fact-label'>{WebUtility.HtmlEncode(label)}</span>
                            <span class='fact-value'>{WebUtility.HtmlEncode(value ?? "-")}</span>
                        </div>");
                }
            }

            return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>
        body {{ margin:0; padding:0; background:#f3f4f6; font-family: Arial, Helvetica, sans-serif; }}
        .wrap {{ width:100%; background:#f3f4f6; padding:24px 10px; }}
        .card {{ max-width:620px; width:100%; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }}
        .hero {{ background:{brandColor}; color:#ffffff; padding:24px 18px; text-align:center; }}
        .hero h1 {{ margin:0; font-size:30px; line-height:1.2; }}
        .hero p {{ margin:8px 0 0; font-size:15px; opacity:0.95; }}
        .content {{ padding:22px 18px; }}
        .content p {{ margin:0 0 12px; color:#1f2937; font-size:15px; line-height:1.5; }}
        .facts {{ margin-top:14px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; }}
        .fact-row {{ display:flex; justify-content:space-between; gap:12px; padding:12px 14px; border-bottom:1px solid #e5e7eb; }}
        .fact-row:last-child {{ border-bottom:none; }}
        .fact-label {{ font-weight:700; color:#374151; }}
        .fact-value {{ color:#111827; text-align:right; word-break:break-word; }}
        .help {{ margin-top:14px; font-size:14px; color:#374151; }}
        .foot {{ border-top:1px solid #e5e7eb; padding:18px 14px; text-align:center; }}
        .foot strong {{ display:block; font-size:13px; color:#111827; }}
        .foot span {{ color:#6b7280; font-size:12px; }}
        @media only screen and (max-width:620px) {{
            .wrap {{ padding:12px 6px; }}
            .hero h1 {{ font-size:25px; }}
            .content {{ padding:16px 12px; }}
            .fact-row {{ display:block; }}
            .fact-label {{ display:block; margin-bottom:4px; }}
            .fact-value {{ display:block; text-align:left; }}
        }}
    </style>
</head>
<body>
    <div class='wrap'>
        <div class='card'>
            <div class='hero'>
                <h1>{WebUtility.HtmlEncode(heading ?? "Order Update")}</h1>
                <p>{WebUtility.HtmlEncode(platformName)}</p>
            </div>
            <div class='content'>
                <p>{WebUtility.HtmlEncode(message ?? "Your order has a new update.")}</p>
                <div class='facts'>
                    {factsHtml}
                </div>
                <p class='help'>Need help? Contact us at <a href='mailto:{supportEmail}' style='color:#2563eb; text-decoration:none;'>{supportEmail}</a>.</p>
            </div>
            <div class='foot'>
                <strong>{footerBrand}</strong>
                <span>&copy; {DateTime.UtcNow.Year} {footerCompany}. All rights reserved.</span>
            </div>
        </div>
    </div>
</body>
</html>";
        }

        private sealed class SellerRecipientInfo
        {
            public long UserId { get; set; }
            public string EmailAddress { get; set; }
            public string StoreNames { get; set; }
        }

        private static string FormatOrderAddress(Order order)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(order?.ShippingAddress)) parts.Add(order.ShippingAddress.Trim());
            if (!string.IsNullOrWhiteSpace(order?.City)) parts.Add(order.City.Trim());
            if (!string.IsNullOrWhiteSpace(order?.State)) parts.Add(order.State.Trim());
            if (!string.IsNullOrWhiteSpace(order?.Country)) parts.Add(order.Country.Trim());
            if (!string.IsNullOrWhiteSpace(order?.PostalCode)) parts.Add(order.PostalCode.Trim());
            return parts.Count == 0 ? "-" : string.Join(", ", parts);
        }

        private async Task FinalizeOrder(Order order)
        {
            var itemsWithStore = await _orderRepository.GetAll()
                .Where(o => o.Id == order.Id).SelectMany(o => o.OrderItems)
                .Select(oi => new { oi.PriceAtPurchase, oi.Quantity, oi.StoreProductId }).ToListAsync();

            var sellerPayments = new Dictionary<long, decimal>();
            foreach (var item in itemsWithStore)
            {
                var storeProduct = await _storeProductRepository.GetAll()
                    .Include(sp => sp.Store).FirstOrDefaultAsync(sp => sp.Id == item.StoreProductId);

                if (storeProduct?.Store != null)
                {
                    var ownerId = storeProduct.Store.OwnerId;
                    var amount = item.PriceAtPurchase * item.Quantity;
                    if (sellerPayments.ContainsKey(ownerId)) sellerPayments[ownerId] += amount;
                    else sellerPayments[ownerId] = amount;
                }
            }

            foreach (var sellerPay in sellerPayments)
            {
                var sellerReferenceId = order.OrderNumber;
                var totalAmount = sellerPay.Value;
                var platformFee = Math.Round(totalAmount * 0.08m, 2);
                var netSellerAmount = totalAmount - platformFee;

                // Credit Seller (92%) to SmartStore wallet.
                await _smartStoreWalletManager.CreditAsync(
                    sellerPay.Key,
                    netSellerAmount,
                    sellerReferenceId,
                    $"Escrow Release: {order.OrderNumber} (Net: {netSellerAmount:F2}, Fee: {platformFee:F2})"
                );
                await TryQueueSellerPayoutEmailAsync(order, sellerPay.Key, totalAmount, platformFee, netSellerAmount);

                Logger.Info(
                    $"[PAYOUT] Order {order.OrderNumber} - Seller {sellerPay.Key}: Net={netSellerAmount:F2}, Fee={platformFee:F2} (8% retained in admin escrow)"
                );
            }

            var supplierOrders = await _supplierOrderRepository.GetAll()
                .Include(so => so.Items).Where(so => so.OrderId == order.Id).ToListAsync();

            foreach (var so in supplierOrders)
            {
                so.Status = "Settled";
                await _supplierOrderRepository.UpdateAsync(so);
            }
        }
    }
}
