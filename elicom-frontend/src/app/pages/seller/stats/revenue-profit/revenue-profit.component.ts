import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { SellerDashboardService, SellerDashboardStats, OrderPaymentTransaction } from '../../../../services/seller-dashboard.service';
import { StoreService } from '../../../../services/store.service';
import { Router } from '@angular/router';
import { AppPageLoaderService } from '../../../../services/app-page-loader.service';
import { ChangeDetectorRef } from '@angular/core';

import { DateRangePickerComponent, DateRangeResult } from '../../../../shared/date-range-picker/date-range-picker.component';

@Component({
  selector: 'app-revenue-profit',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, PercentPipe, DateRangePickerComponent],
  templateUrl: './revenue-profit.component.html',
  styleUrls: ['./revenue-profit.component.scss']
})
export class RevenueProfitComponent implements OnInit {
  private dashboardService = inject(SellerDashboardService);
  private storeService = inject(StoreService);
  private router = inject(Router);
  private loaderService = inject(AppPageLoaderService);
  private cdr = inject(ChangeDetectorRef);

  stats?: SellerDashboardStats;
  transactions: OrderPaymentTransaction[] = [];
  isLoading = false;
  hasLoaded = false;
  currentStore: any;
  currentDateRange: DateRangeResult = { label: 'Maximum Data', id: 'max' };

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.storeService.getMyStoreCached().subscribe((store: any) => {
      this.currentStore = store?.result || store;
      const storeId = this.currentStore?.id || '';

      // Sync Date Range Label if it's the default 'max'
      if (this.currentStore?.createdAt && this.currentDateRange.id === 'max') {
        const date = new Date(this.currentStore.createdAt);
        const formatted = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date);
        this.currentDateRange.label = `Joined Date: ${formatted}`;
      }
      
      this.dashboardService.getStats(storeId, this.currentDateRange.startDate, this.currentDateRange.endDate).subscribe((stats: SellerDashboardStats) => {
        this.stats = stats;
        this.hasLoaded = false;
        
        this.dashboardService.getSaleTransactions(storeId, this.currentDateRange.startDate, this.currentDateRange.endDate).subscribe({
          next: (res: OrderPaymentTransaction[]) => {
            this.transactions = res;
            this.hasLoaded = true;
            this.loaderService.markDataArrived();
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            console.error('Failed to load revenue & profit transactions:', err);
            this.hasLoaded = true;
            this.loaderService.markDataArrived();
            this.cdr.detectChanges();
          }
        });
      });
    });
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
    const s = (status || '').toLowerCase();
    if (s === 'delivered' || s === 'completed' || s === 'shipped') return 'shipped';
    if (s === 'pending' || s === 'processing') return 'pending';
    if (s === 'canceled' || s === 'returned') return 'cancelled';
    return 'default';
  }
}
