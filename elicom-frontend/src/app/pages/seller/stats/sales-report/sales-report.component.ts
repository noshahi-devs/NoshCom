import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { SellerDashboardService, SellerDashboardStats } from '../../../../services/seller-dashboard.service';
import { StoreService } from '../../../../services/store.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppPageLoaderService } from '../../../../services/app-page-loader.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, FormsModule],
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

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.storeService.getMyStoreCached().subscribe((store: any) => {
      this.currentStore = store?.result || store;
      const storeId = this.currentStore?.id || '';
      
      this.dashboardService.getStats(storeId).subscribe({
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
