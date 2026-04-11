import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { SellerDashboardService, SellerDashboardStats } from '../../../../services/seller-dashboard.service';
import { StoreService } from '../../../../services/store.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppPageLoaderService } from '../../../../services/app-page-loader.service';
import { ChangeDetectorRef } from '@angular/core';

import { DateRangePickerComponent, DateRangeResult } from '../../../../shared/date-range-picker/date-range-picker.component';

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, FormsModule, DateRangePickerComponent],
  templateUrl: './sales-report.component.html',
  styleUrls: ['./sales-report.component.scss']
})
export class SalesReportComponent implements OnInit {
  private dashboardService = inject(SellerDashboardService);
  private storeService = inject(StoreService);
  private router = inject(Router);
  private loaderService = inject(AppPageLoaderService);
  private cdr = inject(ChangeDetectorRef);

  stats?: SellerDashboardStats;
  isLoading = false; // Local flag mainly for internal states if needed, but not for UI overlay
  currentStore: any;
  currentDateRange: DateRangeResult = { label: 'Maximum Data', id: 'max' };
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
