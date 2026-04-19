import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { ProductService } from '../../../core/services/product.service';
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
  isLoadingCategories = true;
  pendingDeliveriesCount = '0';
  overviewSeries: { label: string; shortLabel: string; amount: number; orders: number }[] = [];
  topCategories: { name: string; count: number; iconClass: string; accentClass: string }[] = [];
  statsCards = [
    {
      title: 'All Product',
      value: '0',
      iconClass: 'pi-box'
    },
    {
      title: 'Sales Product',
      value: '0',
      iconClass: 'pi-chart-bar'
    },
    {
      title: 'New Order',
      value: '0',
      iconClass: 'pi-shopping-cart'
    }
  ];

  recentOrders: any[] = [];

  constructor(
    public router: Router,
    private orderService: OrderService,
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoadingStats = true;
    this.isLoadingOrders = true;
    this.isLoadingCategories = true;

    forkJoin({
      orders: this.orderService.getAllForSupplier().pipe(
        catchError((err) => {
          console.error('Failed to load seller orders', err);
          return of([]);
        })
      ),
      products: this.productService.getAll().pipe(
        catchError((err) => {
          console.error('Failed to load seller products', err);
          return of([]);
        })
      )
    }).subscribe({
      next: ({ orders, products }) => {
        const allOrders = orders || [];
        const allProducts = products || [];

        this.processStats(allOrders);
        this.topCategories = this.buildTopCategoriesFromProducts(allProducts);

        const latestOrders = allOrders.slice(0, 5);
        this.enrichRecentOrdersWithTracking(latestOrders).subscribe({
          next: (ordersWithTracking) => {
            this.recentOrders = ordersWithTracking;
            this.isLoadingStats = false;
            this.isLoadingOrders = false;
            this.isLoadingCategories = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.recentOrders = latestOrders;
            this.isLoadingStats = false;
            this.isLoadingOrders = false;
            this.isLoadingCategories = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('Failed to load dashboard data', err);
        this.isLoadingStats = false;
        this.isLoadingOrders = false;
        this.isLoadingCategories = false;
        this.cdr.detectChanges();
      }
    });
  }

  private processStats(orders: any[]): void {
    const orderCount = orders.length;
    const pendingCount = orders.filter(o => {
      const s = (o.status || '').toLowerCase();
      return ['pending', 'purchased', 'processing', 'shipped', 'verified'].includes(s);
    }).length;
    const completedSalesCount = orders.filter(o => {
      const s = (o.status || '').toLowerCase();
      return ['delivered', 'settled'].includes(s);
    }).length;
    const totalItems = orders.reduce((sum, order) => {
      const items = order.items || order.orderItems || [];
      return sum + items.reduce((itemSum: number, item: any) => {
        const qty = Number(item?.qty ?? item?.quantity ?? 0);
        return itemSum + (Number.isFinite(qty) ? qty : 0);
      }, 0);
    }, 0);

    this.statsCards[0].value = totalItems.toLocaleString();
    this.statsCards[1].value = completedSalesCount.toLocaleString();
    this.statsCards[2].value = orderCount.toLocaleString();
    this.pendingDeliveriesCount = pendingCount.toLocaleString();
    this.overviewSeries = this.buildOverviewSeries(orders);
  }

  private buildOverviewSeries(orders: any[]): { label: string; shortLabel: string; amount: number; orders: number }[] {
    const currentYear = new Date().getFullYear();

    const buckets = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(currentYear, index, 1);

      return {
        key: `${currentYear}-${String(index + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString(undefined, { month: 'short' }),
        shortLabel: date.toLocaleDateString(undefined, { month: 'short' }),
        amount: 0,
        orders: 0
      };
    });

    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    orders.forEach((order) => {
      const rawDate = order?.creationTime || order?.createdAt || order?.date;
      if (!rawDate) {
        return;
      }

      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) {
        return;
      }

      if (date.getFullYear() !== currentYear) {
        return;
      }

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = bucketMap.get(key);
      if (!bucket) {
        return;
      }

      bucket.orders += 1;
      bucket.amount += this.getOrderAmount(order);
    });

    return buckets;
  }

  getOverviewMaxAmount(): number {
    return Math.max(...this.overviewSeries.map((point) => point.amount), 0);
  }

  getOverviewBarHeight(amount: number): number {
    const max = this.getOverviewMaxAmount();
    if (!max) {
      return 18;
    }

    return Math.max(18, Math.round((amount / max) * 110));
  }

  getOverviewTotalAmount(): number {
    return this.overviewSeries.reduce((sum, point) => sum + point.amount, 0);
  }

  getOverviewTotalOrders(): number {
    return this.overviewSeries.reduce((sum, point) => sum + point.orders, 0);
  }

  getOrderCustomerName(order: any): string {
    return (order?.customerName || order?.recipientName || order?.sellerName || 'Unknown').toString().trim();
  }

  getOrderCategory(order: any): string {
    const items = order?.items || order?.orderItems || [];
    for (const item of items) {
      const itemCategory = this.normalizeCategoryName(
        item?.category || item?.productCategory || item?.group || item?.type || item?.name
      );
      if (itemCategory) {
        return itemCategory;
      }
    }

    return this.normalizeCategoryName(order?.category || order?.productCategory || '') || 'General';
  }

  private buildTopCategoriesFromProducts(products: any[]): { name: string; count: number; iconClass: string; accentClass: string }[] {
    const counts = new Map<string, number>();

    products.forEach((product) => {
      const category = this.getResolvedProductCategoryName(product);
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    const derived = Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        iconClass: this.getCategoryIconClass(name),
        accentClass: this.getCategoryAccentClass(name)
      }))
      .sort((a, b) => b.count - a.count);

    return derived.slice(0, 5);
  }

  private getResolvedProductCategoryName(product: any): string {
    const direct = this.normalizeCategoryName(
      product?.categoryName || product?.category || product?.productCategory || product?.group || product?.type || ''
    );
    if (direct) {
      return direct;
    }

    return this.inferCategoryFromName(
      (product?.name || product?.productName || product?.title || product?.sku || '').toString()
    );
  }

  private normalizeCategoryName(value: any): string {
    const text = (value ?? '').toString().trim();
    if (!text) {
      return '';
    }

    return text
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char: string) => char.toUpperCase());
  }

  private inferCategoryFromName(name: string): string {
    const value = name.toLowerCase();
    if (value.includes('oil') && value.includes('filter')) return 'Oil Filter';
    if (value.includes('ac') && value.includes('filter')) return 'AC Filter';
    if (value.includes('care')) return 'Car Care';
    if (value.includes('interior') || value.includes('seat') || value.includes('mat') || value.includes('cover')) return 'Car Interior';
    if (value.includes('battery')) return 'Car Battery';
    if (value.includes('brake')) return 'Brake Parts';
    if (value.includes('engine')) return 'Engine Parts';
    if (value.includes('filter')) return 'Filters';
    return 'General';
  }

  private getCategoryIconClass(name: string): string {
    const normalized = name.toLowerCase();
    if (normalized.includes('oil')) return 'pi-filter';
    if (normalized.includes('care')) return 'pi-star';
    if (normalized.includes('ac') || normalized.includes('air')) return 'pi-sun';
    if (normalized.includes('interior')) return 'pi-car';
    if (normalized.includes('battery')) return 'pi-bolt';
    if (normalized.includes('brake')) return 'pi-cog';
    if (normalized.includes('engine')) return 'pi-wrench';
    return 'pi-tag';
  }

  private getCategoryAccentClass(name: string): string {
    const normalized = name.toLowerCase();
    if (normalized.includes('oil')) return 'accent-green';
    if (normalized.includes('care')) return 'accent-gold';
    if (normalized.includes('ac')) return 'accent-blue';
    if (normalized.includes('interior')) return 'accent-pink';
    if (normalized.includes('battery')) return 'accent-violet';
    return 'accent-mint';
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

  createSourcingRequest(): void {
    this.router.navigate(['/seller/orders'], { queryParams: { create: '1' } });
  }

  goToCategories(): void {
    this.router.navigate(['/categories']);
  }

  goToShopPage(): void {
    this.router.navigate(['/shop']);
  }

  getPrimaryItemName(order: any): string {
    return this.getPrimaryProductName(order) || 'Product unavailable';
  }

  getOrderItemsCount(order: any): number {
    const items = order?.items || order?.orderItems || [];
    return Array.isArray(items) ? items.length : 0;
  }

  getOrderAmount(order: any): number {
    const directAmount = order?.totalPurchaseAmount ?? order?.totalAmount;
    if (typeof directAmount === 'number') {
      return directAmount;
    }

    const items = order?.items || order?.orderItems || [];
    return items.reduce((sum: number, item: any) => {
      const qty = item?.qty || item?.quantity || 0;
      const price = item?.purchasePrice || item?.price || item?.priceAtPurchase || 0;
      return sum + (qty * price);
    }, 0);
  }

  getOrderReference(order: any): string {
    return order?.referenceCode || order?.orderNumber || order?.id || 'N/A';
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
