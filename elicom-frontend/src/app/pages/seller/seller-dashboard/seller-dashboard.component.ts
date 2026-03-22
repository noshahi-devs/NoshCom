import { Component, OnInit, OnDestroy, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { StoreService } from '../../../services/store.service';
import { SellerDashboardService, SellerDashboardStats } from '../../../services/seller-dashboard.service';
import { StoreProductService } from '../../../services/store-product.service';
import { WalletService } from '../../../services/wallet.service';
import { catchError, map, of, forkJoin } from 'rxjs';
import { DateRangePickerComponent, DateRangeResult } from '../../../shared/date-range-picker/date-range-picker.component';

@Component({
    selector: 'app-seller-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, DateRangePickerComponent],
    templateUrl: './seller-dashboard.component.html',
    styleUrls: ['./seller-dashboard.component.scss']
})
export class SellerDashboardComponent implements OnInit, OnDestroy {
    private authService = inject(AuthService);
    private cdr = inject(ChangeDetectorRef);

    private storeService = inject(StoreService);
    private dashboardService = inject(SellerDashboardService);
    private storeProductService = inject(StoreProductService);
    private walletService = inject(WalletService);

    isSidebarCollapsed = false;
    currentUser: any = null;
    currentStore: any = null;
    isStoreLoading = true;
    isStatsLoading = true;
    stats: SellerDashboardStats | null = null;
    private readonly emptyGuid = '00000000-0000-0000-0000-000000000000';

    // Clock
    currentDate: string = '';
    currentTime: string = '';
    private timer: any;
    private statusCheckTimer: any;
    statsWindow: 'day' | 'week' | 'month' = 'week';
    currentDateRange: DateRangeResult = { label: 'Maximum Data', id: 'max' };

    ngOnInit() {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        this.startClock();

        // Use reactive stream for store updates
        this.storeService.currentStore$.subscribe(store => {
            const wasPending = this.currentStore && !this.currentStore.status;
            this.currentStore = store;

            // Sync Date Range Label if it's the default 'max'
            if (store?.createdAt && this.currentDateRange.id === 'max') {
                const date = new Date(store.createdAt);
                const formatted = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date);
                this.currentDateRange.label = `Joined Date: ${formatted}`;
            }
            
            if (store && store.id) {
                if (wasPending && store.status) {
                    // Approval detected! Stop polling and load everything
                    console.log('Store approved! Loading dashboard data...');
                    this.stopStatusPolling();
                    this.loadStats();
                } else if (!store.status) {
                    this.startStatusPolling();
                } else if (store.status && !this.stats) {
                    // Normal load for already approved store
                    this.loadStats();
                }
            } else if (!store) {
                console.warn('No store found. Trying fallback resolution.');
                this.resolveStoreFallbackAndLoadStats();
            }
            
            this.isStoreLoading = false;
            this.cdr.detectChanges();
        });

        this.loadMyStore();
    }

    ngOnDestroy() {
        this.stopStatusPolling();
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    startClock() {
        this.updateTime();
        this.timer = setInterval(() => {
            this.updateTime();
        }, 1000);
    }

    updateTime() {
        const now = new Date();
        const nyDate = new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'America/New_York'
        }).format(now);
        const nyTime = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/New_York'
        }).format(now);

        this.currentDate = nyDate.replace(/ /g, '-');
        this.currentTime = nyTime;
    }

    loadMyStore() {
        this.isStoreLoading = true;
        this.storeService.getMyStoreCached(true).subscribe({
            next: (res: any) => {
                // Subscription in ngOnInit handles the logic
                this.isStoreLoading = false;
            },
            error: (err) => {
                console.error('Failed to load store:', err);
                this.isStoreLoading = false;
                this.resolveStoreFallbackAndLoadStats();
            }
        });
    }

    private startStatusPolling() {
        if (!this.statusCheckTimer) {
            console.log('Starting store status polling...');
            this.statusCheckTimer = setInterval(() => {
                this.storeService.getMyStoreCached(true).subscribe();
            }, 10000);
        }
    }

    private stopStatusPolling() {
        if (this.statusCheckTimer) {
            console.log('Stopping store status polling.');
            clearInterval(this.statusCheckTimer);
            this.statusCheckTimer = null;
        }
    }

    get displayStoreName(): string {
        const name = (this.currentStore?.name || '').toString().trim();
        return name || 'My Store';
    }

    get storeBadgeClass(): string {
        if (!this.currentStore?.id) {
            return 'bg-secondary-subtle text-secondary border border-secondary';
        }
        return this.currentStore?.status
            ? 'bg-success-subtle text-success border border-success'
            : 'bg-warning-subtle text-warning border border-warning';
    }

    get storeBadgeText(): string {
        if (!this.currentStore?.id) return 'No Store Yet';
        return this.currentStore?.status ? 'Verified Store' : 'Pending Approval';
    }

    loadStats() {
        this.isStatsLoading = true;
        const storeId = (this.currentStore?.id as string) || this.emptyGuid;
        const listingCount$ = this.currentStore?.id
            ? this.storeProductService.getByStore(this.currentStore.id as string).pipe(
                map((res: any) => Array.isArray(res?.result?.items) ? res.result.items.length : 0),
                catchError((err) => {
                    console.warn('Error loading store listings count:', err);
                    return of(null);
                })
            )
            : of(0);

        forkJoin({
            stats: this.dashboardService.getStats(storeId, this.currentDateRange.startDate, this.currentDateRange.endDate).pipe(
                catchError((err) => {
                    console.error('Error loading dashboard stats:', err);
                    return of(this.createEmptyStats());
                })
            ),
            listingCount: listingCount$,
            walletBalance: this.walletService.getMyWallet().pipe(
                map((wallet: any) => Number(wallet?.balance ?? 0)),
                catchError((err) => {
                    console.warn('Error loading seller wallet balance:', err);
                    return of(null);
                })
            )
        }).subscribe({
            next: ({ stats, listingCount, walletBalance }) => {
                const merged: SellerDashboardStats = {
                    ...stats,
                    activeListings: listingCount ?? stats.activeListings,
                    walletBalance: walletBalance ?? stats.walletBalance
                };
                this.stats = merged;
                this.isStatsLoading = false;
                this.cdr.detectChanges();
            },
            error: (err: any) => {
                console.error('Error loading dashboard aggregates:', err);
                this.stats = this.createEmptyStats();
                this.isStatsLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private resolveStoreFallbackAndLoadStats(): void {
        this.storeService.getAllStores().pipe(
            map((res: any) => {
                const payload = res?.result ?? res;
                if (Array.isArray(payload?.items)) return payload.items;
                if (Array.isArray(payload)) return payload;
                return [];
            }),
            catchError((err) => {
                console.warn('Fallback store resolution failed:', err);
                return of([]);
            })
        ).subscribe((stores: any[]) => {
            const userId = Number(this.currentUser?.id);
            const ownedStore = stores.find(s => Number(s?.ownerId) === userId) || null;
            this.currentStore = ownedStore;

            if (!ownedStore) {
                console.warn('No owned store found in fallback list. Loading aggregate seller stats only.');
            }

            this.isStoreLoading = false;
            this.loadStats();
            this.cdr.detectChanges();
        });
    }

    private createEmptyStats(): SellerDashboardStats {
        return {
            activeListings: 0,
            totalSales: 0,
            totalOrders: 0,
            pendingOrders: 0,
            shippedOrders: 0,
            deliveredOrders: 0,
            totalIncome: 0,
            totalExpense: 0,
            newCustomers: 0,
            walletBalance: 0,
            payoutTillNow: 0,
            recentPayout: 0,
            acReserve: 0,
            unitsOrdered: 0,
            avgUnitsPerOrder: 0,
            bulkOrdersCount: 0,
            recentOrders: [],
            weeklyRevenue: [],
            weeklyOrderCount: [],
            // New Fields
            zalandoFees: 0,
            avgSalePerOrder: 0,
            estPayout: 0,
            totalRefunds: 0,
            netProfit: 0,
            netProfitMargin: 0
        };
    }

    toggleSidebar() {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    get storeItemsCount(): number {
        return this.toSafeNumber(this.stats?.activeListings ?? 0);
    }

    get totalProfit(): number {
        const income = this.toSafeNumber(this.stats?.totalIncome);
        // User confirmed: expected 54.01 for 58.71 revenue (Revenue - 8%)
        return Math.max(income * 0.92, 0);
    }

    onRangeChange(range: DateRangeResult): void {
        this.currentDateRange = range;
        if (this.currentStore?.id) {
            this.loadStats();
        }
    }

    setStatsWindow(window: 'day' | 'week' | 'month'): void {
        this.statsWindow = window;
    }

    get recentOrders(): any[] {
        return Array.isArray(this.stats?.recentOrders) ? this.stats!.recentOrders : [];
    }

    get revenueLinePoints(): string {
        const values = this.getWindowedSeries(this.stats?.weeklyRevenue || []);
        return this.buildLinePoints(values, 640, 220, 18);
    }

    get orderVolumeBars(): number[] {
        const values = this.getWindowedSeries(this.stats?.weeklyOrderCount || []);
        const max = Math.max(...values, 1);
        return values.map(v => Math.max(8, Math.round((this.toSafeNumber(v) / max) * 100)));
    }

    get chartLabels(): string[] {
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        if (this.statsWindow === 'day') {
            return ['Now'];
        }

        if (this.statsWindow === 'month') {
            return ['W1', 'W2', 'W3', 'W4'];
        }

        return dayLabels;
    }

    getOrderItemsCount(order: any): number {
        if (!Array.isArray(order?.orderItems)) return 0;
        return order.orderItems.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
    }

    getOrderStatusClass(status: string): string {
        const normalized = (status || '').toLowerCase();
        if (normalized.includes('deliver')) return 'done';
        if (normalized.includes('ship') || normalized.includes('verif')) return 'progress';
        if (normalized.includes('cancel') || normalized.includes('reject')) return 'cancelled';
        return 'pending';
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        // Unused now since picker handles its own click outside
    }

    private toSafeNumber(value: any): number {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    private getWindowedSeries(raw: number[]): number[] {
        const normalized = (raw || []).map(v => this.toSafeNumber(v));
        if (this.statsWindow === 'day') {
            const current = normalized.length ? normalized[normalized.length - 1] : 0;
            return [current];
        }
        if (this.statsWindow === 'month') {
            if (!normalized.length) return [0, 0, 0, 0];
            const chunk = Math.max(1, Math.ceil(normalized.length / 4));
            return [0, 1, 2, 3].map(i => normalized.slice(i * chunk, (i + 1) * chunk).reduce((a, b) => a + b, 0));
        }
        return normalized.length ? normalized : [0, 0, 0, 0, 0, 0, 0];
    }

    private buildLinePoints(values: number[], width: number, height: number, pad: number): string {
        if (!values.length) {
            return `${pad},${height - pad} ${width - pad},${height - pad}`;
        }

        const safe = values.map(v => this.toSafeNumber(v));
        const max = Math.max(...safe, 1);
        const min = Math.min(...safe, 0);
        const range = Math.max(max - min, 1);
        const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;

        return safe
            .map((v, idx) => {
                const x = pad + idx * step;
                const y = height - pad - ((v - min) / range) * (height - pad * 2);
                return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ');
    }
}
