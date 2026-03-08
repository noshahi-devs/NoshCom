import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { SellerDashboardService, SellerDashboardStats, OrderPaymentTransaction } from '../../../../services/seller-dashboard.service';
import { StoreService } from '../../../../services/store.service';
import { Router } from '@angular/router';
import { AppPageLoaderService } from '../../../../services/app-page-loader.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-revenue-profit',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, PercentPipe],
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
  currentStore: any;

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.storeService.getMyStoreCached().subscribe((store: any) => {
      this.currentStore = store?.result || store;
      const storeId = this.currentStore?.id || '';
      
      this.dashboardService.getStats(storeId).subscribe((stats: SellerDashboardStats) => {
        this.stats = stats;
        
        this.dashboardService.getSaleTransactions(storeId).subscribe({
          next: (res: OrderPaymentTransaction[]) => {
            this.transactions = res;
            this.loaderService.markDataArrived();
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            console.error('Failed to load revenue & profit transactions:', err);
            this.loaderService.markDataArrived();
            this.cdr.detectChanges();
          }
        });
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
