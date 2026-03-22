import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { ProductDetail } from './pages/product-detail/product-detail';
import { AddToCart } from './pages/add-to-cart/add-to-cart';
import { Checkout } from './pages/checkout/checkout';
import { SearchResult } from './pages/search-result/search-result';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'product-detail/:productId/:storeProductId', component: ProductDetail },
  { path: 'add-to-cart', component: AddToCart },
  { path: 'checkout', component: Checkout },
  { path: 'search-result', component: SearchResult },
  { path: 'corporate/our-impact', loadComponent: () => import('./pages/corporate/our-impact/our-impact.component').then(m => m.OurImpactComponent) },
  { path: 'corporate/:pageId', loadComponent: () => import('./pages/corporate/corporate-page.component').then(m => m.CorporatePageComponent) },
  { path: 'smartstore/auth', loadComponent: () => import('./pages/auth/login-page.component').then(m => m.LoginPageComponent) },
  { path: 'smartstore/login', redirectTo: 'smartstore/auth', pathMatch: 'full' },
  { path: 'smartstore/signup', redirectTo: 'smartstore/auth', pathMatch: 'full' },
  { path: 'primeship/auth', loadComponent: () => import('./pages/auth/login-page.component').then(m => m.LoginPageComponent) },
  { path: 'primeship/login', redirectTo: 'primeship/auth', pathMatch: 'full' },
  { path: 'primeship/signup', redirectTo: 'primeship/auth', pathMatch: 'full' },

  { path: 'seller/store-creation', loadComponent: () => import('./pages/seller/store-creation/store-creation.component').then(m => m.StoreCreationComponent), canActivate: [AuthGuard] },
  {
    path: 'seller',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/seller/seller-layout/seller-layout.component').then(m => m.SellerLayoutComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/seller/seller-dashboard/seller-dashboard.component').then(m => m.SellerDashboardComponent) },
      { path: 'add-product', loadComponent: () => import('./pages/seller/add-product-mapping/add-product-mapping.component').then(m => m.AddProductMappingComponent) },
      { path: 'listings', loadComponent: () => import('./pages/seller/product-listing/product-listing.component').then(m => m.ProductListingComponent) },
      { path: 'favorites', loadComponent: () => import('./pages/seller/coming-soon/coming-soon.component').then(m => m.SellerComingSoonComponent) },
      { path: 'orders', redirectTo: 'orders/unshipped', pathMatch: 'full' },
      { path: 'orders/details/:id', loadComponent: () => import('./pages/seller/orders/order-details/order-details.component').then(m => m.OrderDetailsComponent) },
      {
        path: 'orders/unshipped',
        loadComponent: () => import('./pages/seller/orders/orders.component').then(m => m.SellerOrdersComponent),
        data: { orderView: 'unshipped' }
      },
      {
        path: 'orders/tracking-verifications',
        loadComponent: () => import('./pages/seller/orders/orders.component').then(m => m.SellerOrdersComponent),
        data: { orderView: 'tracking-verifications' }
      },
      {
        path: 'orders/shipped',
        loadComponent: () => import('./pages/seller/orders/orders.component').then(m => m.SellerOrdersComponent),
        data: { orderView: 'shipped' }
      },
      {
        path: 'orders/canceled',
        loadComponent: () => import('./pages/seller/orders/orders.component').then(m => m.SellerOrdersComponent),
        data: { orderView: 'canceled' }
      },
      {
        path: 'orders/rejected-trackings',
        loadComponent: () => import('./pages/seller/orders/orders.component').then(m => m.SellerOrdersComponent),
        data: { orderView: 'rejected-trackings' }
      },
      {
        path: 'orders/returned-refunded',
        loadComponent: () => import('./pages/seller/orders/orders.component').then(m => m.SellerOrdersComponent),
        data: { orderView: 'returned-refunded' }
      },
      { path: 'orders/3pl-partners', loadComponent: () => import('./pages/seller/shipping-partners/shipping-partners.component').then(m => m.ShippingPartnersComponent) },
      { path: 'logistics', redirectTo: 'orders/3pl-partners', pathMatch: 'full' },
      { path: 'warehouse', loadComponent: () => import('./pages/seller/warehouse/warehouse.component').then(m => m.WarehouseComponent) },
      { path: 'finances/wallet', loadComponent: () => import('./pages/seller/wallet-center/wallet-center.component').then(m => m.WalletCenterComponent) },
      { path: 'finances/payouts', redirectTo: 'finances/payouts/pending', pathMatch: 'full' },
      {
        path: 'finances/payouts/pending',
        loadComponent: () => import('./pages/seller/payout-transactions/payout-transactions.component').then(m => m.PayoutTransactionsComponent),
        data: { payoutMode: 'pending' }
      },
      {
        path: 'finances/payouts/completed',
        loadComponent: () => import('./pages/seller/payout-transactions/payout-transactions.component').then(m => m.PayoutTransactionsComponent),
        data: { payoutMode: 'completed' }
      },
      {
        path: 'finances/payouts/refunds',
        loadComponent: () => import('./pages/seller/payout-transactions/payout-transactions.component').then(m => m.PayoutTransactionsComponent),
        data: { payoutMode: 'refunds' }
      },
      { path: 'finances/add-payment-method', loadComponent: () => import('./pages/seller/add-payment-method/add-payment-method.component').then(m => m.AddPaymentMethodComponent) },
      { path: 'stats/sales-report', loadComponent: () => import('./pages/seller/stats/sales-report/sales-report.component').then(m => m.SalesReportComponent) },
      { path: 'stats/revenue-profit', loadComponent: () => import('./pages/seller/stats/revenue-profit/revenue-profit.component').then(m => m.RevenueProfitComponent) },
      { path: 'settings', loadComponent: () => import('./pages/seller/coming-soon/coming-soon.component').then(m => m.SellerComingSoonComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'admin',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/admin/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      { path: 'stores', loadComponent: () => import('./pages/admin/store-approvals/store-approvals.component').then(m => m.StoreApprovalsComponent) },
      { path: 'kyc', loadComponent: () => import('./pages/admin/store-approvals/store-approvals.component').then(m => m.StoreApprovalsComponent) },
      { path: 'settings', loadComponent: () => import('./pages/admin/global-settings/global-settings.component').then(m => m.GlobalSettingsComponent) },
      { path: 'payouts', loadComponent: () => import('./pages/admin/financial-payouts/financial-payouts.component').then(m => m.FinancialPayoutsComponent) },
      { path: 'users', loadComponent: () => import('./pages/admin/user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'orders', loadComponent: () => import('./pages/admin/admin-orders/admin-orders.component').then(m => m.AdminOrdersComponent) },
      { path: 'orders/details/:id', loadComponent: () => import('./pages/seller/orders/order-details/order-details.component').then(m => m.OrderDetailsComponent) },
      { path: 'dashboard', loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
      { path: 'manage-sellers', loadComponent: () => import('./pages/admin/manage-sellers/manage-sellers.component').then(m => m.ManageSellersComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'customer',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/customer/customer-layout/customer-layout.component').then(m => m.CustomerLayoutComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/customer/customer-dashboard/customer-dashboard.component').then(m => m.CustomerDashboardComponent) },
      { path: 'orders', loadComponent: () => import('./pages/customer/customer-orders/customer-orders.component').then(m => m.CustomerOrdersComponent) },
      { path: 'orders/:status', loadComponent: () => import('./pages/customer/customer-orders/customer-orders.component').then(m => m.CustomerOrdersComponent) },
      { path: 'payment', loadComponent: () => import('./pages/customer/customer-payment/customer-payment.component').then(m => m.CustomerPaymentComponent) },
      { path: 'wishlist', loadComponent: () => import('./pages/customer/customer-wishlist/customer-wishlist.component').then(m => m.CustomerWishlistComponent) },
      { path: 'support', loadComponent: () => import('./pages/customer/customer-support/customer-support.component').then(m => m.CustomerSupportComponent) },
      { path: 'shipping', loadComponent: () => import('./pages/customer/customer-shipping/customer-shipping.component').then(m => m.CustomerShippingComponent) },
      { path: 'history', loadComponent: () => import('./pages/customer/customer-history/customer-history.component').then(m => m.CustomerHistoryComponent) },
      { path: 'profile', loadComponent: () => import('./pages/customer/customer-profile/customer-profile.component').then(m => m.CustomerProfileComponent) },
      { path: 'address', loadComponent: () => import('./pages/customer/customer-address/customer-address.component').then(m => m.CustomerAddressComponent) },
      { path: 'policy', loadComponent: () => import('./pages/customer/customer-policy/customer-policy.component').then(m => m.CustomerPolicyComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];
