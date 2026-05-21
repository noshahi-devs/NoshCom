import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { SellerDashboardService, SellerDashboardStats } from '../../../../services/seller-dashboard.service';
import { StoreService } from '../../../../services/store.service';
import { OrderService } from '../../../../services/order.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppPageLoaderService } from '../../../../services/app-page-loader.service';

import { DateRangePickerComponent, DateRangeResult } from '../../../../shared/date-range-picker/date-range-picker.component';

type OrderStatusFilter = 'all' | 'delivered' | 'pending' | 'reject';

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, FormsModule, DateRangePickerComponent],
  templateUrl: './sales-report.component.html',
  styleUrls: ['./sales-report.component.scss']
})
export class SalesReportComponent implements OnInit, OnDestroy {
  private dashboardService = inject(SellerDashboardService);
  private storeService = inject(StoreService);
  private orderService = inject(OrderService);
  private router = inject(Router);
  private loaderService = inject(AppPageLoaderService);
  private cdr = inject(ChangeDetectorRef);

  stats?: SellerDashboardStats;
  isLoading = false;
  ordersLoading = false;
  currentStore: any;
  currentDateRange: DateRangeResult = { label: 'Maximum Data', id: 'max' };
  statusFilter: OrderStatusFilter = 'all';
  allOrders: any[] = [];
  filteredOrders: any[] = [];
  currentPage = 1;
  pageSize = 10;
  currentTimeDisplay = '';
  currentDateDisplay = '';
  hourHandRotation = 0;
  minuteHandRotation = 0;
  secondHandRotation = 0;
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
    this.loadData();
  }

  ngOnDestroy() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  loadData() {
    this.storeService.getMyStoreCached().subscribe((store: any) => {
      this.currentStore = store?.result || store;
      const storeId = this.currentStore?.id || '';

      // Sync Date Range Label if it's the default 'max'
      if (this.currentStore?.createdAt && this.currentDateRange.id === 'max') {
        const date = new Date(this.currentStore.createdAt);
        const formatted = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date);
        this.currentDateRange.label = `Joined: ${formatted}`;
      }
      
      this.dashboardService.getStats(storeId, this.currentDateRange.startDate, this.currentDateRange.endDate).subscribe({
        next: (res: SellerDashboardStats) => {
          this.stats = res;
          this.loaderService.markDataArrived();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Failed to load sales report stats:', err);
          this.loaderService.markDataArrived();
          this.cdr.detectChanges();
        }
      });

      this.loadOrders(storeId);
    });
  }

  private loadOrders(storeId: string): void {
    if (!storeId) {
      this.allOrders = [];
      this.applyOrderFilters();
      return;
    }

    this.ordersLoading = true;
    this.orderService.getOrdersByStore(storeId).subscribe({
      next: (response) => {
        const res = response.body?.result || [];
        this.allOrders = Array.isArray(res) ? res : [];
        this.ordersLoading = false;
        this.applyOrderFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load sales report orders:', err);
        this.allOrders = [];
        this.ordersLoading = false;
        this.applyOrderFilters();
        this.cdr.detectChanges();
      }
    });
  }

  setStatusFilter(filter: OrderStatusFilter): void {
    this.statusFilter = filter;
    this.currentPage = 1;
    this.applyOrderFilters();
  }

  get pagedOrders(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredOrders.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredOrders.length / this.pageSize));
  }

  get showingFrom(): number {
    if (!this.filteredOrders.length) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get showingTo(): number {
    if (!this.filteredOrders.length) return 0;
    return Math.min(this.currentPage * this.pageSize, this.filteredOrders.length);
  }

  goPrevious(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  goNext(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  private applyOrderFilters(): void {
    let list = [...this.allOrders];

    if (this.currentDateRange.startDate) {
      const start = new Date(this.currentDateRange.startDate);
      list = list.filter((order) => {
        const createdAt = this.parseOrderDate(order?.creationTime);
        return createdAt ? createdAt >= start : false;
      });
    }

    if (this.currentDateRange.endDate) {
      const end = new Date(this.currentDateRange.endDate);
      end.setHours(23, 59, 59, 999);
      list = list.filter((order) => {
        const createdAt = this.parseOrderDate(order?.creationTime);
        return createdAt ? createdAt <= end : false;
      });
    }

    if (this.statusFilter !== 'all') {
      list = list.filter((order) => this.matchesStatusFilter(order?.status));
    }

    list.sort((a, b) => {
      const aTs = this.parseOrderDate(a?.creationTime)?.getTime() || 0;
      const bTs = this.parseOrderDate(b?.creationTime)?.getTime() || 0;
      return bTs - aTs;
    });

    this.filteredOrders = list;

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  private matchesStatusFilter(status: string): boolean {
    const key = this.normalizeStatus(status);

    switch (this.statusFilter) {
      case 'delivered':
        return key === 'delivered';
      case 'pending':
        return [
          'pending',
          'processing',
          'shipped',
          'shippedfromhub',
          'verified',
          'pendingverification'
        ].includes(key);
      case 'reject':
        return [
          'rejected',
          'cancelled',
          'canceled',
          'cancel',
          'rejectedtracking',
          'trackingrejected'
        ].includes(key);
      default:
        return true;
    }
  }

  private normalizeStatus(status: string): string {
    return (status || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  private parseOrderDate(value: any): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  onRangeChange(range: DateRangeResult) {
    this.currentDateRange = range;
    this.loadData();
  }

  goToOrderDetails(orderId: string) {
    if (orderId) {
      this.router.navigate(['/seller/orders/details', orderId]);
    }
  }

  getRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  }

  getStatusClass(status: string): string {
    const s = this.normalizeStatus(status);
    if (s === 'delivered' || s === 'completed') return 'shipped';
    if (['pending', 'processing', 'shipped', 'shippedfromhub', 'verified', 'pendingverification'].includes(s)) {
      return 'pending';
    }
    if (['rejected', 'cancelled', 'canceled', 'cancel', 'rejectedtracking', 'trackingrejected'].includes(s)) {
      return 'rejected';
    }
    return 'default';
  }

  private updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    this.currentTimeDisplay = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    this.currentDateDisplay = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(/ /g, '-');

    this.hourHandRotation = ((hours % 12) + minutes / 60) * 30;
    this.minuteHandRotation = (minutes + seconds / 60) * 6;
    this.secondHandRotation = seconds * 6;
  }
}
