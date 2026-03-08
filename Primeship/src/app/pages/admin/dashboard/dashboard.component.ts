import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { Router } from '@angular/router';

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

  statsCards = [
    {
      title: 'Total Revenue',
      value: '',
      change: '+0%',
      trend: 'up',
      icon: '💰',
      color: 'success',
      gradient: 'linear-gradient(135deg, #f85606 0%, #ff8c42 100%)'
    },
    {
      title: 'Total Orders',
      value: '0',
      change: '+0%',
      trend: 'up',
      icon: '🧾',
      color: 'info',
      gradient: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
    },
    {
      title: 'Active Sellers',
      value: '0',
      change: '+0%',
      trend: 'up',
      icon: '🏪',
      color: 'warning',
      gradient: 'linear-gradient(135deg, #f85606 0%, #b43d04 100%)'
    },
    {
      title: 'Delivered Orders',
      value: '0',
      change: '+0%',
      trend: 'up',
      icon: '📦',
      color: 'success',
      gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
    },
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
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const cached = this.hydrateFromCache();
    // If cache existed, show it immediately; still refresh from network
    this.isLoadingStats = !cached;
    this.isLoadingOrders = !cached;
    this.cdr.detectChanges();
    this.loadAdminStats();
  }

  loadAdminStats(): void {
    // If cache already hydrated, keep loaders off; otherwise ensure they show
    if (this.isLoadingStats || this.isLoadingOrders) {
      this.cdr.detectChanges();
    }
    this.orderService.getAllOrders().subscribe({
      next: (res) => {
        this.processAdminStats(res);
        this.recentOrders = res.slice(0, 5);
        this.persistCache(res);
        this.isLoadingStats = false;
        this.isLoadingOrders = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load admin stats', err);
        this.isLoadingStats = false;
        this.isLoadingOrders = false;
        this.cdr.detectChanges();
      }
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

    this.statsCards[0].value = '$' + totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    this.statsCards[1].value = orderCount.toString();
    this.statsCards[2].value = uniqueSellers.size.toString();
    this.statsCards[3].value = deliveredCount.toString();

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
      this.isLoadingStats = false;
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
}
