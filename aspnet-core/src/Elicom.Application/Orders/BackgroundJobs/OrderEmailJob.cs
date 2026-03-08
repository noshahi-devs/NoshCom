using Abp.BackgroundJobs;
using Abp.Dependency;
using Abp.Domain.Repositories;
using Elicom.BackgroundJobs;
using Elicom.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using Abp.Domain.Uow;
using Elicom.Authorization.Users;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Text;

namespace Elicom.Orders.BackgroundJobs
{
    public class OrderEmailJob : AsyncBackgroundJob<OrderEmailJobArgs>, ITransientDependency
    {
        private readonly IRepository<Order, Guid> _orderRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;
        private readonly UserManager _userManager;
        private readonly IBackgroundJobManager _backgroundJobManager;

        public OrderEmailJob(
            IRepository<Order, Guid> orderRepository,
            IRepository<StoreProduct, Guid> storeProductRepository,
            UserManager userManager,
            IBackgroundJobManager backgroundJobManager)
        {
            _orderRepository = orderRepository;
            _storeProductRepository = storeProductRepository;
            _userManager = userManager;
            _backgroundJobManager = backgroundJobManager;
        }

        [UnitOfWork(System.Transactions.TransactionScopeOption.Suppress)]
        public override async Task ExecuteAsync(OrderEmailJobArgs args)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var order = await _orderRepository.GetAll()
                    .Include(o => o.OrderItems)
                    .FirstOrDefaultAsync(o => o.Id == args.OrderId);

                if (order == null)
                {
                    Logger.Warn($"OrderEmailJob: Order with ID {args.OrderId} not found.");
                    return;
                }

                try
                {
                    var user = await _userManager.FindByIdAsync(order.UserId.ToString());
                    var customerEmail = user?.EmailAddress ?? order.RecipientEmail;
                    var adminEmail = "noshahidevelopersinc@gmail.com";
                    var branding = ResolveBranding(order.SourcePlatform);
                    var customerName = !string.IsNullOrWhiteSpace(order.RecipientName)
                        ? order.RecipientName
                        : (!string.IsNullOrWhiteSpace(user?.Name) ? user.Name : "Customer");

                    var storeProductIds = order.OrderItems.Select(oi => oi.StoreProductId).ToList();
                    var storeProducts = await _storeProductRepository.GetAll()
                        .Include(sp => sp.Store)
                        .Where(sp => storeProductIds.Contains(sp.Id))
                        .ToListAsync();
                    var byStoreProductId = storeProducts.ToDictionary(sp => sp.Id, sp => sp);

                    var allRows = BuildInvoiceRows(order, byStoreProductId);

                    // 1) Customer invoice mail
                    var customerBody = BuildOrderInvoiceHtml(
                        branding,
                        "Order Invoice",
                        "Your order has been received successfully.",
                        "Customer Copy",
                        customerName,
                        order,
                        allRows,
                        "All Stores");
                    await SendEmailAsync(branding.PlatformName, customerEmail, $"Order Invoice - {order.OrderNumber}", customerBody);

                    // 2) Admin new-order mail
                    var adminBody = BuildOrderInvoiceHtml(
                        branding,
                        "Order Invoice",
                        "New order invoice for your review.",
                        "Admin Copy",
                        "Admin Team",
                        order,
                        allRows,
                        "All Stores");
                    await SendEmailAsync(branding.PlatformName, adminEmail, $"[ALERT] New Order - {order.OrderNumber}", adminBody);

                    // 3) Seller invoice mail (per store owner)
                    var storeGroups = storeProducts.GroupBy(sp => sp.StoreId);
                    foreach (var group in storeGroups)
                    {
                        var store = group.First().Store;
                        var owner = await _userManager.FindByIdAsync(store.OwnerId.ToString());
                        if (owner != null)
                        {
                            var sellerRows = allRows
                                .Where(x => x.StoreId == store.Id)
                                .ToList();
                            if (!sellerRows.Any())
                            {
                                sellerRows = allRows;
                            }

                            var sellerBody = BuildOrderInvoiceHtml(
                                branding,
                                "Order Invoice",
                                "New order invoice for your review.",
                                "Seller Copy",
                                string.IsNullOrWhiteSpace(owner.Name) ? owner.UserName : owner.Name,
                                order,
                                sellerRows,
                                store.Name);

                            await SendEmailAsync(branding.PlatformName, owner.EmailAddress, $"New Order Received - {order.OrderNumber}", sellerBody);
                        }
                    }
                }
                catch (Exception ex)
                {
                    Logger.Error("Failed to send order placement emails", ex);
                    throw; // Re-throw to let ABP retry the job
                }
            }
        }

        private async Task SendEmailAsync(string platformName, string to, string subject, string body)
        {
            if (string.IsNullOrWhiteSpace(to))
            {
                return;
            }

            try
            {
                await _backgroundJobManager.EnqueueAsync<PlatformEmailJob, PlatformEmailJobArgs>(
                    new PlatformEmailJobArgs
                {
                    PlatformName = platformName,
                    To = to,
                    Subject = subject,
                    HtmlBody = body
                });
            }
            catch (Exception ex)
            {
                Logger.Error($"Email error to {to}: {ex.Message}");
            }
        }

        private static (string PlatformName, string BrandColor, string SupportEmail, string FooterBrand, string FooterCompany) ResolveBranding(string sourcePlatform)
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

            return ("World Cart", "#000000", "info@worldcartus.com.", "WORLD CART US", "World Cart Inc.");
        }

        private static List<InvoiceLineRow> BuildInvoiceRows(
            Order order,
            IReadOnlyDictionary<Guid, StoreProduct> byStoreProductId)
        {
            var rows = new List<InvoiceLineRow>();
            if (order?.OrderItems == null)
            {
                return rows;
            }

            foreach (var oi in order.OrderItems)
            {
                byStoreProductId.TryGetValue(oi.StoreProductId, out var sp);
                var quantity = oi.Quantity <= 0 ? 1 : oi.Quantity;
                rows.Add(new InvoiceLineRow
                {
                    StoreId = sp?.StoreId,
                    StoreName = !string.IsNullOrWhiteSpace(oi.StoreName) ? oi.StoreName : (sp?.Store?.Name ?? "Store"),
                    ProductTitle = !string.IsNullOrWhiteSpace(oi.ProductName) ? oi.ProductName : "Product",
                    Quantity = quantity,
                    ItemTotal = oi.PriceAtPurchase * quantity
                });
            }

            return rows;
        }

        private static string BuildOrderInvoiceHtml(
            (string PlatformName, string BrandColor, string SupportEmail, string FooterBrand, string FooterCompany) branding,
            string title,
            string subtitle,
            string copyType,
            string recipientName,
            Order order,
            IReadOnlyList<InvoiceLineRow> rows,
            string storeName)
        {
            var nowUtc = DateTime.UtcNow;
            var currency = CultureInfo.GetCultureInfo("en-US");
            var receiveDate = order.CreationTime == default ? nowUtc : order.CreationTime;
            var address = FormatAddress(order);

            var rowsHtml = new StringBuilder();
            foreach (var row in rows)
            {
                rowsHtml.Append($@"
                    <tr class='line-row'>
                        <td data-label='Product Title' class='col-title'>{WebUtility.HtmlEncode(row.ProductTitle)}</td>
                        <td data-label='Quantity' class='col-qty'>{row.Quantity}</td>
                        <td data-label='Item Price' class='col-price'>{row.ItemTotal.ToString("C", currency)}</td>
                    </tr>");
            }

            var orderTotal = order.TotalAmount.ToString("C", currency);
            var subTotal = order.SubTotal.ToString("C", currency);
            var shipping = order.ShippingCost.ToString("C", currency);
            var discount = order.Discount.ToString("C", currency);
            var paymentStatus = string.IsNullOrWhiteSpace(order.PaymentStatus) ? "Pending" : order.PaymentStatus;
            var paymentMethod = string.IsNullOrWhiteSpace(order.PaymentMethod) ? "-" : order.PaymentMethod;
            var safeStore = string.IsNullOrWhiteSpace(storeName) ? "Store" : storeName;

            return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>
        body {{ margin:0; padding:0; background:#f3f4f6; font-family: Arial, Helvetica, sans-serif; }}
        .wrap {{ width:100%; background:#f3f4f6; padding:24px 10px; }}
        .card {{ max-width:640px; width:100%; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }}
        .hero {{ background:{branding.BrandColor}; color:#ffffff; text-align:center; padding:28px 18px; }}
        .hero h1 {{ margin:0; font-size:36px; line-height:1.1; }}
        .hero p {{ margin:8px 0 0; font-size:15px; opacity:0.95; }}
        .section {{ padding:24px 24px 18px; border-top:1px solid #e5e7eb; }}
        .section h2 {{ margin:0 0 12px; font-size:20px; color:#111827; }}
        .meta p {{ margin:6px 0; color:#1f2937; font-size:15px; }}
        .label {{ font-weight:700; }}
        .line-table {{ width:100%; border-collapse:collapse; table-layout:fixed; }}
        .line-table th {{ background:{branding.BrandColor}; color:#ffffff; text-align:left; padding:12px; font-size:15px; }}
        .line-table th.qty, .line-table td.col-qty {{ width:90px; text-align:center; }}
        .line-table th.price, .line-table td.col-price {{ width:130px; text-align:right; }}
        .line-table td {{ border:1px solid #e5e7eb; padding:12px; color:#111827; font-size:14px; vertical-align:top; word-break:break-word; }}
        .totals {{ background:{branding.BrandColor}; color:#ffffff; padding:14px 16px; }}
        .totals-row {{ display:flex; justify-content:space-between; margin:4px 0; font-size:15px; }}
        .totals-row.total {{ font-size:26px; font-weight:700; margin-top:8px; }}
        .badge {{ display:inline-block; background:#eef2ff; color:#3730a3; border:1px solid #c7d2fe; padding:3px 8px; border-radius:999px; font-size:12px; margin-left:8px; }}
        .foot {{ text-align:center; padding:22px 16px; color:#6b7280; font-size:12px; border-top:1px solid #e5e7eb; }}
        .foot strong {{ display:block; color:#111827; font-size:13px; margin-bottom:6px; }}
        @media only screen and (max-width:620px) {{
            .wrap {{ padding:12px 6px; }}
            .hero h1 {{ font-size:30px; }}
            .section {{ padding:16px 14px 12px; }}
            .line-table thead {{ display:none; }}
            .line-table, .line-table tbody, .line-table tr, .line-table td {{ display:block; width:100% !important; }}
            .line-table tr {{ border:1px solid #e5e7eb; border-radius:10px; margin:0 0 10px; overflow:hidden; }}
            .line-table td {{ border:none; border-bottom:1px solid #f3f4f6; padding:10px 12px; text-align:left !important; }}
            .line-table td:last-child {{ border-bottom:none; }}
            .line-table td::before {{ content:attr(data-label) ': '; font-weight:700; color:#4b5563; }}
            .line-table td.col-title {{ font-weight:600; }}
            .totals-row.total {{ font-size:22px; }}
        }}
    </style>
</head>
<body>
    <div class='wrap'>
        <div class='card'>
            <div class='hero'>
                <h1>{WebUtility.HtmlEncode(title)}</h1>
                <p>{WebUtility.HtmlEncode(subtitle)}</p>
            </div>

            <div class='section'>
                <h2>Order Details</h2>
                <div class='meta'>
                    <p><span class='label'>Store:</span> {WebUtility.HtmlEncode(safeStore)}</p>
                    <p><span class='label'>Order Number:</span> {WebUtility.HtmlEncode(order.OrderNumber)}</p>
                    <p><span class='label'>Receive Date:</span> {receiveDate:MM-dd-yyyy HH:mm:ss}</p>
                    <p><span class='label'>Payment Method:</span> {WebUtility.HtmlEncode(paymentMethod)} <span class='badge'>{WebUtility.HtmlEncode(paymentStatus)}</span></p>
                    <p><span class='label'>Copy:</span> {WebUtility.HtmlEncode(copyType)}</p>
                </div>
            </div>

            <div class='section'>
                <h2>Billing Information</h2>
                <div class='meta'>
                    <p><span class='label'>Buyer name:</span> {WebUtility.HtmlEncode(recipientName)}</p>
                    <p><span class='label'>Address:</span> {WebUtility.HtmlEncode(address)}</p>
                    <p><span class='label'>Address type:</span> Shipping</p>
                    <p><span class='label'>Contact:</span> {WebUtility.HtmlEncode(order.RecipientPhone ?? "-")}</p>
                </div>
            </div>

            <div class='section'>
                <table class='line-table' role='presentation' cellpadding='0' cellspacing='0'>
                    <thead>
                        <tr>
                            <th>Product Title</th>
                            <th class='qty'>Quantity</th>
                            <th class='price'>Item Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rowsHtml}
                    </tbody>
                </table>
            </div>

            <div class='totals'>
                <div class='totals-row'><span>Subtotal</span><span>{subTotal}</span></div>
                <div class='totals-row'><span>Shipping</span><span>{shipping}</span></div>
                <div class='totals-row'><span>Discount</span><span>-{discount}</span></div>
                <div class='totals-row total'><span>Order Total</span><span>{orderTotal}</span></div>
            </div>

            <div class='section' style='padding-top:18px; border-top:none;'>
                <div class='meta'>
                    <p>Need help? Contact us at <a href='mailto:{branding.SupportEmail}' style='color:#2563eb; text-decoration:none;'>{branding.SupportEmail}</a>.</p>
                </div>
            </div>

            <div class='foot'>
                <strong>{branding.FooterBrand}</strong>
                <div>&copy; {DateTime.UtcNow.Year} {branding.FooterCompany}. All rights reserved.</div>
            </div>
        </div>
    </div>
</body>
</html>";
        }

        private static string FormatAddress(Order order)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(order.ShippingAddress)) parts.Add(order.ShippingAddress.Trim());
            if (!string.IsNullOrWhiteSpace(order.City)) parts.Add(order.City.Trim());
            if (!string.IsNullOrWhiteSpace(order.State)) parts.Add(order.State.Trim());
            if (!string.IsNullOrWhiteSpace(order.Country)) parts.Add(order.Country.Trim());
            if (!string.IsNullOrWhiteSpace(order.PostalCode)) parts.Add(order.PostalCode.Trim());
            return parts.Count == 0 ? "-" : string.Join(", ", parts);
        }

        private sealed class InvoiceLineRow
        {
            public Guid? StoreId { get; set; }
            public string StoreName { get; set; }
            public string ProductTitle { get; set; }
            public int Quantity { get; set; }
            public decimal ItemTotal { get; set; }
        }
    }
}
