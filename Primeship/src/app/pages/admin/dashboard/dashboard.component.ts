import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { Router } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { ProductService } from '../../../core/services/product.service';
import { catchError, finalize, of, timeout, switchMap } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  isLoadingStats = true;
  isLoadingOrders = true;
  private statsLoad = {
    orders: true,
    categories: true,
    products: true
  };

  statsCards = [
    {
      title: 'Total Revenue',
      value: '',
      change: '+0%',
      trend: 'up',
      icon: '💰',
      color: 'success',
      gradient: 'linear-gradient(135deg, #f85606 0%, #ff8c42 100%)',
      route: '/admin/finance'
    },
    {
      title: 'Total Orders',
      value: '0',
      change: '+0%',
      trend: 'up',
      icon: '🧾',
      color: 'info',
      gradient: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      route: '/admin/orders'
    },
    {
      title: 'Active Sellers',
      value: '0',
      change: '+0%',
      trend: 'up',
      icon: '🏪',
      color: 'warning',
      gradient: 'linear-gradient(135deg, #f85606 0%, #b43d04 100%)',
      route: '/admin/sellers'
    },
    {
      title: 'Delivered Orders',
      value: '0',
      change: '+0%',
      trend: 'up',
      icon: '📦',
      color: 'success',
      gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      route: '/admin/orders'
    },
    {
      title: 'Total Categories',
      value: '0',
      change: '+0%',
      trend: 'up',
      icon: '🗂️',
      color: 'info',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #1f2937 100%)',
      route: '/admin/categories'
    },
    {
      title: 'Total Products',
      value: '0',
      change: '+0%',
      trend: 'up',
      icon: '🛍️',
      color: 'info',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
      route: '/admin/products'
    }
  ];

  recentOrders: any[] = [];
  private readonly cacheKey = 'adminDashboardOrders';

  statusOverview = {
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    total: 0,
  };
  averageOrderValue = 0;
  itemsPurchased = 0;

  constructor(
    private orderService: OrderService,
    private categoryService: CategoryService,
    private productService: ProductService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const cached = this.hydrateFromCache();
    // Always keep stats loader until fresh values arrive
    this.isLoadingStats = true;
    this.isLoadingOrders = !cached;
    this.statsLoad = { orders: true, categories: true, products: true };
    this.cdr.detectChanges();
    this.loadAdminStats();
    this.loadCategoryCount();
    this.loadProductCount();
  }

  loadAdminStats(): void {
    // If cache already hydrated, keep loaders off; otherwise ensure they show
    if (this.isLoadingStats || this.isLoadingOrders) {
      this.cdr.detectChanges();
    }
    this.orderService.getAllOrders().pipe(
      timeout(8000),
      catchError(err => {
        console.error('Failed to load admin stats', err);
        return of([] as any[]);
      }),
      finalize(() => {
        this.isLoadingOrders = false;
        this.statsLoad.orders = false;
        this.updateStatsLoading();
        this.cdr.detectChanges();
      })
    ).subscribe(res => {
      this.processAdminStats(res || []);
      this.recentOrders = (res || []).slice(0, 5);
      this.persistCache(res || []);
    });
  }

  private processAdminStats(orders: any[]): void {
    const totalRevenue = orders.reduce((sum, o) => {
      const total = o.totalPurchaseAmount ?? o.totalAmount ?? 0;
      if (total) return sum + total;

      const items = this.getItems(o);
      const computed = items.reduce((iSum, it) => {
        const qty = Number(it.qty ?? it.quantity ?? 0);
        const price = Number(it.purchasePrice ?? it.price ?? it.priceAtPurchase ?? 0);
        return iSum + qty * price;
      }, 0);
      return sum + computed;
    }, 0);

    const orderCount = orders.length;

    // Count unique sellers and products; status mix
    const uniqueSellers = new Set();
    const uniqueProducts = new Set();
    let deliveredCount = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let shippedCount = 0;
    let cancelledCount = 0;
    let totalItems = 0;

    orders.forEach(o => {
      if (o.sellerId) uniqueSellers.add(o.sellerId);

      const items = this.getItems(o);
      items.forEach((it: any) => {
        if (it.name) uniqueProducts.add(it.name);
        totalItems += Number(it.qty ?? it.quantity ?? 0);
      });

      const s = (o.status || '').toLowerCase();
      if (['delivered', 'settled', 'verified'].includes(s)) deliveredCount++;
      else if (['pending', 'purchased'].includes(s)) pendingCount++;
      else if (['processing'].includes(s)) processingCount++;
      else if (['shipped'].includes(s)) shippedCount++;
      else if (['cancelled'].includes(s)) cancelledCount++;
    });

    this.updateCardValue('Total Revenue', '$' + totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    this.updateCardValue('Total Orders', orderCount.toString());
    this.updateCardValue('Active Sellers', uniqueSellers.size.toString());
    this.updateCardValue('Delivered Orders', deliveredCount.toString());

    this.statusOverview = {
      pending: pendingCount,
      processing: processingCount,
      shipped: shippedCount,
      delivered: deliveredCount,
      cancelled: cancelledCount,
      total: orderCount,
    };
    this.averageOrderValue = orderCount ? totalRevenue / orderCount : 0;
    this.itemsPurchased = totalItems;

    // Replace array reference to force view update in case change detection misses in-place mutation
    this.statsCards = [...this.statsCards];
  }

  private loadCategoryCount(): void {
    this.categoryService.getAll().pipe(
      timeout(8000),
      catchError(err => {
        console.error('Failed to load categories count', err);
        return of([]);
      }),
      finalize(() => {
        this.statsLoad.categories = false;
        this.updateStatsLoading();
        this.cdr.detectChanges();
      })
    ).subscribe(cats => {
      this.updateCardValue('Total Categories', (cats?.length || 0).toString());
    });
  }

  private loadProductCount(): void {
    this.productService.getAll().pipe(
      timeout(8000),
      catchError(err => {
        console.error('Failed to load products count', err);
        return of(null as any[] | null);
      }),
      switchMap(products => {
        const count = products?.length ?? 0;
        if (count > 0) {
          return of(count);
        }
        return this.productService.getMarketplaceProductCount().pipe(
          timeout(8000),
          catchError(err => {
            console.error('Failed to load marketplace product count', err);
            return of(0);
          })
        );
      }),
      finalize(() => {
        this.statsLoad.products = false;
        this.updateStatsLoading();
        this.cdr.detectChanges();
      })
    ).subscribe(count => {
      this.updateCardValue('Total Products', (count || 0).toString());
    });
  }

  private getItems(order: any): any[] {
    return order?.items || order?.orderItems || [];
  }

  private hydrateFromCache(): boolean {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return false;
      const orders = JSON.parse(raw);
      if (!Array.isArray(orders)) return false;
      this.processAdminStats(orders);
      this.recentOrders = orders.slice(0, 5);
      this.isLoadingOrders = false;
      return true;
    } catch {
      return false;
    }
  }

  private persistCache(orders: any[]): void {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(orders));
    } catch {
      // ignore storage failures
    }
  }

  private updateStatsLoading(): void {
    this.isLoadingStats = this.statsLoad.orders || this.statsLoad.categories || this.statsLoad.products;
  }

  private updateCardValue(title: string, value: string): void {
    const card = this.statsCards.find(c => c.title === title);
    if (!card) return;
    card.value = value;
    this.statsCards = [...this.statsCards];
  }

  getStatusColor(status: string): string {
    if (!status) return 'info';
    const s = status.toLowerCase();
    if (s === 'delivered' || s === 'settled') return 'success';
    if (s === 'pending' || s === 'purchased') return 'warning';
    if (s === 'processing' || s === 'shipped') return 'info';
    if (s === 'cancelled') return 'danger';
    return 'info';
  }

  getStatusLabel(status: string): string {
    if (!status) return 'Unknown';
    switch (status.toLowerCase()) {
      case 'purchased':
      case 'pending': return 'Pending';
      case 'settled':
      case 'delivered': return 'Delivered';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  onQuickAction(route: string) {
    this.router.navigate([route]);
  }

  onStatCardClick(card: any) {
    if (card?.route) {
      this.router.navigate([card.route]);
    }
  }
}
