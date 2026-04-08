import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/admin/dashboard/dashboard.component';
import { ProductsComponent } from './pages/admin/products/products.component';
import { SellerDashboardComponent } from './pages/seller/dashboard/seller-dashboard.component';
import { SellerOrdersComponent } from './pages/seller/orders/orders.component';
import { CategoriesComponent } from './pages/admin/categories/categories.component';
import { OrdersComponent } from './pages/admin/orders/orders.component';
import { ThreeplPartnersComponent } from './pages/admin/threepl-partners/threepl-partners.component';
import { CustomersComponent } from './pages/admin/customers/customers.component';
import { SellersComponent } from './pages/admin/sellers/sellers.component';
import { FinanceComponent } from './pages/admin/finance/finance.component';
import { UsersComponent } from './pages/admin/users/users.component';
import { HomeComponent } from './public/home/home.component';
import { AuthGuard } from './core/guards/auth.guard';

import { PublicLayoutComponent } from './public/public-layout/public-layout.component';
import { AdminLayoutComponent } from './pages/admin/admin-layout/admin-layout.component';
import { AboutUsComponent, ReturnsPolicyComponent, ContactSupportComponent, TrackOrderComponent } from './public/pages/info-pages.component';
import {
  VerifiedComponent,
  CollaborationsComponent,
  ShopByRoomComponent,
  InspirationComponent,
  ServicesComponent,
  DesignServicesComponent,
  GiftCardComponent,
  RewardsComponent,
  CreditCardComponent,
  FinancingComponent,
  CashRegistryComponent
} from './public/pages/feature-pages.component';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./public/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'outdoor-shop',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./public/product-list/product-list.component').then(m => m.ProductListComponent),
        data: {
          categorySlug: 'outdoor',
          title: 'The Outdoor Shop',
          description: 'Outdoor furniture, patio picks, and garden-ready essentials.',
          fallbackAll: true,
          maxProducts: 60,
          hideNonProductUI: true
        }
      }
    ]
  },
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        component: HomeComponent
      },
      {
        path: 'category/:slug',
        loadComponent: () => import('./public/product-list/product-list.component').then(m => m.ProductListComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./public/category-list/category-list.component').then(m => m.CategoryListComponent)
      },
      {
        path: 'shop',
        loadComponent: () => import('./public/product-list/product-list.component').then(m => m.ProductListComponent)
      },
      {
        path: 'product/:slug',
        loadComponent: () => import('./public/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
      },
      {
        path: 'cart',
        loadComponent: () => import('./public/cart/cart.component').then(m => m.CartComponent)
      },
      {
        path: 'wishlist',
        loadComponent: () => import('./public/pages/wishlist/wishlist.component').then(c => c.WishlistComponent)
      },
      {
        path: 'checkout',
        loadComponent: () => import('./public/checkout/checkout.component').then(m => m.CheckoutComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'account',
        loadChildren: () => import('./public/account/account.module').then(m => m.AccountModule),
        canActivate: [AuthGuard]
      },
      {
        path: 'about-us',
        loadComponent: () => import('./public/pages/about-us/about-us.component').then(c => c.AboutUsComponent)
      },
      {
        path: 'returns-policy',
        loadComponent: () => import('./public/pages/returns-policy/returns-policy.component').then(c => c.ReturnsPolicyComponent)
      },
      {
        path: 'contact-support',
        loadComponent: () => import('./public/pages/contact-support/contact-support.component').then(c => c.ContactSupportComponent)
      },
      {
        path: 'track-order',
        loadComponent: () => import('./public/pages/track-order/track-order.component').then(c => c.TrackOrderComponent)
      },
      {
        path: 'verified',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'collaborations',
        component: CollaborationsComponent
      },
      {
        path: 'shop-by-room',
        component: ShopByRoomComponent
      },
      {
        path: 'inspiration',
        component: InspirationComponent
      },
      {
        path: 'services',
        component: ServicesComponent
      },
      {
        path: 'design-services',
        component: DesignServicesComponent
      },
      {
        path: 'gift-card',
        component: GiftCardComponent
      },
      {
        path: 'rewards',
        component: RewardsComponent
      },
      {
        path: 'credit-card',
        component: CreditCardComponent
      },
      {
        path: 'financing',
        component: FinancingComponent
      },
      {
        path: 'cash-registry',
        component: CashRegistryComponent
      }
    ]
  },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        component: DashboardComponent
      },
      {
        path: 'products',
        component: ProductsComponent
      },
      {
        path: 'categories',
        component: CategoriesComponent
      },
      {
        path: 'orders',
        component: OrdersComponent
      },
      {
        path: 'threepl-partners',
        component: ThreeplPartnersComponent
      },
      {
        path: 'customers',
        component: CustomersComponent
      },
      {
        path: 'sellers',
        component: SellersComponent
      },
      {
        path: 'finance',
        component: FinanceComponent
      },
      {
        path: 'reports',
        component: DashboardComponent // Placeholder
      },
      {
        path: 'users',
        component: UsersComponent
      },
      {
        path: 'settings',
        component: DashboardComponent // Placeholder
      }
    ]
  },
  {
    path: 'seller',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/seller/dashboard/seller-dashboard.component').then(m => m.SellerDashboardComponent)
      },
      {
        path: 'products',
        component: DashboardComponent // Placeholder
      },
      {
        path: 'orders',
        component: SellerOrdersComponent
      },
      {
        path: 'earnings',
        component: DashboardComponent // Placeholder
      },
      {
        path: 'profile',
        component: DashboardComponent // Placeholder
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];
