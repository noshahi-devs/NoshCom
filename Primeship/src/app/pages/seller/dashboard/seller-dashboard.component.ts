import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
        const allOrders = res || [];
        this.processStats(allOrders);
        const latestOrders = allOrders.slice(0, 5);

        this.enrichRecentOrdersWithTracking(latestOrders).subscribe({
          next: (ordersWithTracking) => {
            this.recentOrders = ordersWithTracking;
            this.isLoadingStats = false;
            this.isLoadingOrders = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.recentOrders = latestOrders;
            this.isLoadingStats = false;
            this.isLoadingOrders = false;
            this.cdr.detectChanges();
          }
        });
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

  private enrichRecentOrdersWithTracking(orders: any[]): Observable<any[]> {
    if (!orders.length) {
      return of([]);
    }

    const requests = orders.map((order) => {
      if (this.resolveTrackingValue(order)) {
        return of(order);
      }

      const linkedOrderId = order?.orderId;
      if (!linkedOrderId) {
        return of(order);
      }

      return this.orderService.getOrderById(linkedOrderId).pipe(
        map((linkedOrder: any) => {
          const linkedTracking = this.resolveTrackingValue(linkedOrder);
          if (!linkedTracking) {
            return order;
          }

          return {
            ...order,
            trackingCode: order?.trackingCode || linkedOrder?.trackingCode || linkedTracking,
            deliveryTrackingNumber: order?.deliveryTrackingNumber || linkedOrder?.deliveryTrackingNumber,
            primeShipTrackingNumber: order?.primeShipTrackingNumber || linkedOrder?.primeShipTrackingNumber
          };
        }),
        catchError(() => of(order))
      );
    });

    return forkJoin(requests);
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

  getTrackingDisplayValue(order: any): string {
    const tracking = this.normalizeTrackingValue(this.resolveTrackingValue(order), order);
    if (tracking) {
      return tracking;
    }

    const status = (order?.status || '').toLowerCase();
    if (status === 'delivered' || status === 'settled' || status === 'shipped' || status === 'verified') {
      console.warn('[SellerDashboard] Tracking not found for order:', {
        id: order?.id,
        orderId: order?.orderId,
        referenceCode: order?.referenceCode,
        status: order?.status,
        payload: order
      });
    }

    if (status === 'pending' || status === 'purchased') {
      return 'Awaiting confirmation';
    }

    return 'Tracking pending';
  }

  private resolveTrackingValue(source: any): string {
    if (!source || typeof source !== 'object') {
      return '';
    }

    const direct = [
      source?.trackingCode,
      source?.deliveryTrackingNumber,
      source?.primeShipTrackingNumber,
      source?.trackingNumber,
      source?.trackingNo,
      source?.primeShipInfo?.trackingNumber,
      source?.order?.trackingCode,
      source?.order?.deliveryTrackingNumber,
      source?.order?.primeShipTrackingNumber
    ].find((value: any) => (typeof value === 'string' || typeof value === 'number') && `${value}`.trim().length > 0);

    if (direct !== undefined) {
      return `${direct}`.trim();
    }

    return this.findTrackingDeep(source, 0) || '';
  }

  private normalizeTrackingValue(raw: any, order: any): string {
    const value = (raw ?? '').toString().trim();
    if (!value) {
      return '';
    }

    if (this.isNewTrackingFormat(value)) {
      return value;
    }

    const productName = this.getPrimaryProductName(order);
    const initials = this.extractTrackingInitials(productName);
    const digitsOnly = value.replace(/\D/g, '');
    if (!digitsOnly) {
      return value;
    }

    const tenDigits = digitsOnly.length >= 10
      ? digitsOnly.slice(-10)
      : digitsOnly.padStart(10, '0');

    return `UK-${initials}${tenDigits}`;
  }

  private isNewTrackingFormat(value: string): boolean {
    return /^UK-[A-Z]{2}\d{10}$/.test(value);
  }

  private extractTrackingInitials(name: string): string {
    const letters = (name || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    if (!letters) {
      return 'XX';
    }
    return `${letters[0]}${letters[letters.length - 1]}`;
  }

  private getPrimaryProductName(order: any): string {
    const items = order?.items || order?.orderItems || [];
    for (const item of items) {
      const name = (item?.productName || item?.name || '').toString().trim();
      if (name) {
        return name;
      }
    }
    return '';
  }

  private findTrackingDeep(node: any, depth: number): string {
    if (!node || depth > 4) {
      return '';
    }

    if (typeof node !== 'object') {
      return '';
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = this.findTrackingDeep(item, depth + 1);
        if (found) {
          return found;
        }
      }
      return '';
    }

    for (const [key, value] of Object.entries(node)) {
      if (key.toLowerCase().includes('tracking') && (typeof value === 'string' || typeof value === 'number')) {
        const normalized = `${value}`.trim();
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }

    for (const value of Object.values(node)) {
      const found = this.findTrackingDeep(value, depth + 1);
      if (found) {
        return found;
      }
    }

    return '';
  }
}
