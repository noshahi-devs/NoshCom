import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';

@Component({
  selector: 'app-seller-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seller-dashboard.component.html',
  styleUrls: ['./seller-dashboard.component.scss']
})
export class SellerDashboardComponent implements OnInit {
  isLoadingStats = true;
  isLoadingOrders = true;
  statsCards = [
    {
      title: 'Total Sales',
      value: '$0',
      change: '+0%',
      trend: 'up',
      icon: '💰',
      gradient: 'linear-gradient(135deg, #f85606 0%, #ff8b52 100%)'
    },
    {
      title: 'Sourced Items',
      value: '0',
      change: '0',
      trend: 'up',
      icon: '📦',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
      title: 'Total Orders',
      value: '0',
      change: '+0%',
      trend: 'up',
      icon: '🛒',
      gradient: 'linear-gradient(135deg, #f85606 0%, #ff9f43 100%)'
    },
    {
      title: 'Pending Deliveries',
      value: '0',
      change: '0',
      trend: 'up',
      icon: '🚚',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    }
  ];

  recentOrders: any[] = [];

  constructor(
    public router: Router,
    private orderService: OrderService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoadingStats = true;
    this.isLoadingOrders = true;
    this.orderService.getAllForSupplier().subscribe({
      next: (res) => {
        this.processStats(res || []);
        this.recentOrders = (res || []).slice(0, 5);
        this.isLoadingStats = false;
        this.isLoadingOrders = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load dashboard data', err);
        this.isLoadingStats = false;
        this.isLoadingOrders = false;
        this.cdr.detectChanges();
      }
    });
  }

  private processStats(orders: any[]): void {
    const totalSpending = orders.reduce((sum, o) => {
      const total = o.totalPurchaseAmount || o.totalAmount;
      if (total !== undefined) return sum + total;

      const items = o.items || o.orderItems || [];
      const calculated = items.reduce((iSum: number, it: any) => {
        const qty = it.qty || it.quantity || 0;
        const price = it.purchasePrice || it.price || it.priceAtPurchase || 0;
        return iSum + (qty * price);
      }, 0);
      return sum + calculated;
    }, 0);

    const orderCount = orders.length;
    const pendingCount = orders.filter(o => {
      const s = (o.status || '').toLowerCase();
      return ['pending', 'purchased', 'processing', 'shipped', 'verified'].includes(s);
    }).length;

    // Count unique products
    const uniqueProducts = new Set();
    orders.forEach(o => {
      const items = o.items || o.orderItems || [];
      items.forEach((it: any) => {
        if (it.name || it.productName) uniqueProducts.add(it.name || it.productName);
      });
    });

    this.statsCards[0].value = '$' + totalSpending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    this.statsCards[1].value = uniqueProducts.size.toString();
    this.statsCards[2].value = orderCount.toString();
    this.statsCards[3].value = pendingCount.toString();
  }

  navigateToOrders() {
    this.router.navigate(['/seller/orders']);
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
}
