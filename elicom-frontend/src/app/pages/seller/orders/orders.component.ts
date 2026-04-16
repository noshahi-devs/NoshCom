import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { StoreService } from '../../../services/store.service';
import Swal from 'sweetalert2';

type OrderViewKey =
    | 'unshipped'
    | 'tracking-verifications'
    | 'shipped'
    | 'canceled'
    | 'rejected-trackings'
    | 'returned-refunded';

interface OrderViewConfig {
    key: OrderViewKey;
    title: string;
    description: string;
    iconClass: string;
    dateHeading: string;
    showShipVia: boolean;
}

interface SellerOrderRow {
    guid: string;
    orderId: string;
    createdAt: Date | null;
    statusRaw: string;
    statusKey: string;
    statusLabel: string;
    customerName: string;
    shipBy: string;
    deliverBy: string;
    salesChannel: string;
    shipVia: string;
    trackingId: string;
    total: number;
    source: any;
    initialAgeMs: number;
    loadTimestamp: number;
}

@Component({
    selector: 'app-seller-orders',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './orders.component.html',
    styleUrls: ['./orders.component.scss']
})
export class SellerOrdersComponent implements OnInit, OnDestroy {
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private orderService = inject(OrderService);
    private storeService = inject(StoreService);
    private cdr = inject(ChangeDetectorRef);
    private zone = inject(NgZone);

    isLoading = false;
    isClockSynced = false;
    syncOffset = 0;
    searchTerm = '';
    pageSize = 10;
    currentPage = 1;
    currentStore: any = null;
    currentTime = '';
    currentDate = '';
    hourHandRotation = 0;
    minuteHandRotation = 0;
    secondHandRotation = 0;

    orderView: OrderViewKey = 'unshipped';
    viewConfig: OrderViewConfig = this.getViewConfig('unshipped');

    private allOrders: SellerOrderRow[] = [];
    filteredOrders: SellerOrderRow[] = [];

    private routeDataSub: any;
    private relativeTimeTimer: any;
    private clockTimer: ReturnType<typeof setInterval> | null = null;
    private nowEpoch = Date.now();
    private serverClockOffset = 0; // ms to add to Date.now() to sync with server

    ngOnInit(): void {
        this.routeDataSub = this.route.data.subscribe((data) => {
            const requestedView = (data?.['orderView'] as OrderViewKey) || 'unshipped';
            this.orderView = requestedView;
            this.viewConfig = this.getViewConfig(requestedView);
            this.currentPage = 1;
            this.applyFilters();
        });

        this.startRelativeTicker();
        this.startClock();
        this.loadStoreSummary();
        this.loadOrders();
    }

    ngOnDestroy(): void {
        if (this.routeDataSub?.unsubscribe) {
            this.routeDataSub.unsubscribe();
        }
        if (this.relativeTimeTimer) {
            clearInterval(this.relativeTimeTimer);
            this.relativeTimeTimer = null;
        }
        if (this.clockTimer) {
            clearInterval(this.clockTimer);
            this.clockTimer = null;
        }
    }

    get displayStoreName(): string {
        return (this.currentStore?.name || 'Your Store').toString().trim();
    }

    get pagedOrders(): SellerOrderRow[] {
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

    onSearchChange(): void {
        this.currentPage = 1;
        this.applyFilters();
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

    viewOrderDetails(order: SellerOrderRow): void {
        if (!order?.guid) return;
        this.router.navigate(['/seller/orders/details', order.guid], {
            state: { order: order.source, fromView: this.orderView }
        });
    }

    cancelOrder(order: SellerOrderRow): void {
        if (!order?.guid) return;

        Swal.fire({
            title: 'Cancel this order?',
            text: `Are you sure you want to cancel order ${order.orderId}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6366f1',
            confirmButtonText: 'Yes, cancel order',
            cancelButtonText: 'Keep order'
        }).then((result) => {
            if (!result.isConfirmed) return;

            this.isLoading = true;
            this.orderService.cancelOrder(order.guid).subscribe({
                next: () => {
                    Swal.fire('Cancelled', 'Order cancelled successfully.', 'success');
                    this.loadOrders();
                },
                error: (err) => {
                    console.error('Failed to cancel order', err);
                    this.isLoading = false;
                    Swal.fire('Error', err?.error?.error?.message || 'Failed to cancel order.', 'error');
                }
            });
        });
    }

    rejectOrder(order: SellerOrderRow): void {
        if (!order?.guid) return;

        Swal.fire({
            title: 'Reject this order?',
            text: `Reject order ${order.orderId}? After rejection it cannot be shipped again.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6366f1',
            confirmButtonText: 'Yes, reject order',
            cancelButtonText: 'Back'
        }).then((result) => {
            if (!result.isConfirmed) return;

            this.isLoading = true;
            this.orderService.rejectOrder(order.guid).subscribe({
                next: () => {
                    Swal.fire('Rejected', 'Order rejected successfully.', 'success');
                    this.loadOrders();
                },
                error: (err) => {
                    console.error('Failed to reject order', err);
                    this.isLoading = false;
                    const message = err?.error?.error?.message || err?.error?.message || err?.message || 'Unknown error';
                    Swal.fire('Error', `Failed to reject order: ${message}`, 'error');
                }
            });
        });
    }

    getRelativeTime(row: SellerOrderRow): string {
        if (!row.createdAt) return '-';
        
        // Use the initial age calculated at load time + elapsed time since load
        const elapsedSinceLoad = Date.now() - row.loadTimestamp;
        const totalAgeMs = Math.max(0, row.initialAgeMs + elapsedSinceLoad);
        
        const seconds = Math.floor((totalAgeMs / 1000) % 60);
        const minutes = Math.floor((totalAgeMs / 1000 / 60) % 60);
        const hours = Math.floor((totalAgeMs / (1000 * 60 * 60)) % 24);
        const days = Math.floor(totalAgeMs / (1000 * 60 * 60 * 24));

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }

    formatDate(value: Date | null): string {
        if (!value) return '-';
        return value.toLocaleDateString('en-GB');
    }

    formatTime(value: Date | null): string {
        if (!value) return '-';
        return value.toLocaleTimeString('en-US', { hour12: false });
    }

    getRangeStart(value: string): string {
        const text = (value || '').trim();
        if (!text) return '-';
        const parts = text.split(' to ');
        return (parts[0] || text).trim();
    }

    getRangeEnd(value: string): string {
        const text = (value || '').trim();
        if (!text) return '';
        const parts = text.split(' to ');
        return (parts[1] || '').trim();
    }

    getStatusClass(statusKey: string): string {
        if (statusKey === 'pending' || statusKey === 'processing') return 'badge-unshipped';
        if (statusKey === 'shipped' || statusKey === 'shippedfromhub') return 'badge-shipped';
        if (statusKey === 'verified') return 'badge-verified';
        if (statusKey === 'delivered') return 'badge-delivered';
        if (statusKey === 'cancelled' || statusKey === 'canceled' || statusKey === 'cancel') return 'badge-canceled';
        if (statusKey === 'rejected' || statusKey === 'rejectedtracking' || statusKey === 'trackingrejected') return 'badge-rejected';
        if (statusKey === 'return' || statusKey === 'returned' || statusKey === 'refunded' || statusKey === 'refund' || statusKey === 'refund/return') return 'badge-returned';
        return 'badge-default';
    }

    private loadOrders(): void {
        this.isLoading = true;
        const cachedStoreId = this.storeService.getCachedStoreId();

        if (cachedStoreId) {
            this.fetchOrders(cachedStoreId);
            this.storeService.getMyStoreCached(true).subscribe({
                next: (storeRes) => {
                    const refreshedStoreId = storeRes?.result?.id || storeRes?.id;
                    if (refreshedStoreId && refreshedStoreId !== cachedStoreId) {
                        this.fetchOrders(refreshedStoreId);
                    }
                },
                error: () => {
                    // Ignore background refresh errors.
                }
            });
            return;
        }

        this.storeService.getMyStoreCached().subscribe({
            next: (storeRes) => {
                const storeId = storeRes?.result?.id || storeRes?.id;
                if (!storeId) {
                    this.isLoading = false;
                    this.allOrders = [];
                    this.applyFilters();
                    this.cdr.detectChanges();
                    return;
                }
                this.fetchOrders(storeId);
            },
            error: (err) => {
                console.error('Failed to load seller store', err);
                this.isLoading = false;
                this.allOrders = [];
                this.applyFilters();
                this.cdr.detectChanges();
            }
        });
    }

    private fetchOrders(storeId: string): void {
        this.orderService.getOrdersByStore(storeId).subscribe({
            next: (response) => {
                const res = response.body?.result || [];
                const loadTimestamp = Date.now();
                
                // Step 1: Sync Clock (User Laptop vs Server UTC)
                const serverDateStr = response.headers.get('Date') || response.headers.get('date');
                const serverDate = this.parseUTC(serverDateStr);
                
                if (serverDate) {
                    this.isClockSynced = true;
                    this.syncOffset = serverDate.getTime() - Date.now();
                } else {
                    this.isClockSynced = false;
                    this.syncOffset = 0;
                }

                const serverNow = this.isClockSynced ? (Date.now() + this.syncOffset) : Date.now();

                // Step 2: Convert to Rows
                const rows = (res || []).map((order: any) => this.toRow(order));

                // Step 3: AUTO-DETECT DATABASE TIMEZONE ERROR
                // Most databases store time in Server Local (e.g. EST) or UTC. 
                // We detect the systemic gap between Server Clock and Order Timestamps.
                let dbCorrectionMs = 0;
                const pendingOrders = rows.filter((r: SellerOrderRow) => r.statusKey === 'pending' && r.createdAt);
                if (pendingOrders.length > 0) {
                    const newestOrderTime = Math.max(...pendingOrders.map((r: SellerOrderRow) => r.createdAt!.getTime()));
                    const rawAge = serverNow - newestOrderTime;
                    
                    // Usually a whole number of hours (Timezone Offset).
                    const hoursRaw = rawAge / 3600000;
                    // We use floor to ensure we don't snap to 0s if the gap is slightly less 
                    // than the next whole hour. This preserves the elapsed minutes.
                    const wholeHours = Math.floor(hoursRaw);
                    
                    if (wholeHours >= 1 && wholeHours <= 14) {
                        dbCorrectionMs = wholeHours * 3600000;
                        console.log(`Smart Sync: Applied ${wholeHours}h timezone correction.`);
                    }
                }

                // Step 4: Finalize Timing
                rows.forEach((row: SellerOrderRow) => {
                    if (row.createdAt) {
                        // Apply the detected DB correction to the creation time
                        row.initialAgeMs = Math.max(0, serverNow - (row.createdAt.getTime() + dbCorrectionMs));
                        row.loadTimestamp = loadTimestamp;
                    }
                });
                
                this.allOrders = rows;
                this.isLoading = false;
                this.applyFilters();
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to load store orders', err);
                this.isLoading = false;
                this.allOrders = [];
                this.applyFilters();
                this.cdr.detectChanges();
            }
        });
    }

    private loadStoreSummary(): void {
        this.storeService.currentStore$.subscribe((store) => {
            this.currentStore = store;
        });

        this.storeService.getMyStoreCached(true).subscribe({
            next: (storeRes: any) => {
                this.currentStore = storeRes?.result || storeRes || this.currentStore;
            },
            error: () => {
                // Ignore hero refresh errors.
            }
        });
    }

    private applyFilters(): void {
        const term = (this.searchTerm || '').trim().toLowerCase();
        const filteredByView = this.allOrders.filter((o) => this.matchesCurrentView(o.statusKey));

        this.filteredOrders = filteredByView.filter((o) => {
            if (!term) return true;
            const haystack = [
                o.orderId,
                o.customerName,
                o.statusLabel,
                o.shipVia,
                o.trackingId,
                o.salesChannel
            ].join(' ').toLowerCase();
            return haystack.includes(term);
        });

        this.filteredOrders.sort((a, b) => {
            const aTs = a.createdAt ? a.createdAt.getTime() : 0;
            const bTs = b.createdAt ? b.createdAt.getTime() : 0;
            return bTs - aTs;
        });

        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
        }
    }

    private toRow(order: any): SellerOrderRow {
        const createdAt = this.parseUTC(order?.creationTime);
        const statusKey = this.normalizeStatus(order?.status);
        const shipBy = this.computeRange(createdAt, 1, 2);
        const deliverBy = this.computeRange(createdAt, 3, 7);

        return {
            guid: order?.id,
            orderId: order?.orderNumber || order?.id || '-',
            createdAt,
            statusRaw: order?.status || '',
            statusKey,
            statusLabel: this.getStatusLabel(statusKey, order?.status),
            customerName: order?.recipientName || order?.customerName || 'Retail Customer',
            shipBy,
            deliverBy,
            salesChannel: this.resolveSalesChannel(order?.sourcePlatform),
            shipVia: order?.carrierId || '-',
            trackingId: order?.trackingCode || order?.deliveryTrackingNumber || '-',
            total: this.toNumber(order?.totalAmount),
            initialAgeMs: 0,
            loadTimestamp: 0,
            source: order
        };
    }

    private parseUTC(dateValue: any): Date | null {
        if (!dateValue) return null;
        if (dateValue instanceof Date) return dateValue;
        
        let s = String(dateValue).trim();
        // Robust regex to extract date and time components
        const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
        
        if (match) {
            const [ , y, mon, d, h, min, sec, msStr] = match;
            // Standardize milliseconds (up to 3 digits)
            const ms = msStr ? parseInt(msStr.substring(0, 3).padEnd(3, '0')) : 0;
            // Force UTC epoch
            return new Date(Date.UTC(+y, +mon - 1, +d, +h, +min, +sec, ms));
        }
        
        // Fallback for strings that might already have Z or an explicit offset at the VERY END
        if (!s.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
            s += 'Z';
        }
        const fallback = new Date(s);
        return isNaN(fallback.getTime()) ? null : fallback;
    }

    private matchesCurrentView(statusKey: string): boolean {
        switch (this.orderView) {
            case 'unshipped':
                return statusKey === 'pending' || statusKey === 'processing';
            case 'tracking-verifications':
                return ['shipped', 'shippedfromhub', 'verified', 'pendingverification'].includes(statusKey);
            case 'shipped':
                return ['shipped', 'shippedfromhub', 'verified', 'delivered'].includes(statusKey);
            case 'canceled':
                return ['cancelled', 'canceled', 'cancel'].includes(statusKey);
            case 'rejected-trackings':
                return ['rejectedtracking', 'trackingrejected', 'rejected'].includes(statusKey);
            case 'returned-refunded':
                return ['return', 'returned', 'refund/return', 'refunded', 'refund'].includes(statusKey);
            default:
                return true;
        }
    }

    private getStatusLabel(statusKey: string, rawStatus: string): string {
        if (statusKey === 'pending' || statusKey === 'processing') return 'Unshipped';
        
        if (this.orderView === 'tracking-verifications') {
            if (statusKey === 'shipped' || statusKey === 'shippedfromhub') return 'Pending Verification';
            if (statusKey === 'verified') return 'Verified';
        }

        if (statusKey === 'pendingverification') return 'Pending Verification';
        if (statusKey === 'shipped' || statusKey === 'shippedfromhub') return 'Shipped';
        if (statusKey === 'verified') return 'Verified';
        if (statusKey === 'delivered') return 'Delivered';
        if (statusKey === 'cancelled' || statusKey === 'canceled' || statusKey === 'cancel') return 'Canceled';
        if (statusKey === 'rejectedtracking' || statusKey === 'trackingrejected' || statusKey === 'rejected') return 'Rejected';
        if (statusKey === 'return' || statusKey === 'returned' || statusKey === 'refunded' || statusKey === 'refund' || statusKey === 'refund/return') return 'Returned & Refunded';
        return rawStatus || 'Unknown';
    }

    private getViewConfig(view: OrderViewKey): OrderViewConfig {
        const configs: Record<OrderViewKey, OrderViewConfig> = {
            'unshipped': {
                key: 'unshipped',
                title: 'Unshipped Orders',
                description: 'You have unshipped orders awaiting fulfillment. Please process these orders promptly to ensure timely delivery to your customers.',
                iconClass: 'fa-solid fa-list-check',
                dateHeading: 'Order date',
                showShipVia: false
            },
            'tracking-verifications': {
                key: 'tracking-verifications',
                title: 'Tracking Verifications',
                description: 'Manage and monitor your tracking information to ensure accurate status updates and verification.',
                iconClass: 'fa-solid fa-list-check',
                dateHeading: 'Order date',
                showShipVia: true
            },
            'shipped': {
                key: 'shipped',
                title: 'Shipped Orders',
                description: 'Your orders have been successfully shipped and are now in transit. Keep an eye on your email for delivery updates and tracking details.',
                iconClass: 'fa-solid fa-truck-fast',
                dateHeading: 'Ship date',
                showShipVia: true
            },
            'canceled': {
                key: 'canceled',
                title: 'Canceled Orders',
                description: 'Below is the list of orders that have been canceled by the seller.',
                iconClass: 'fa-solid fa-square-xmark',
                dateHeading: 'Cancel date',
                showShipVia: false
            },
            'rejected-trackings': {
                key: 'rejected-trackings',
                title: 'Trackings Rejected',
                description: 'The following tracking IDs have been rejected and could not be processed.',
                iconClass: 'fa-solid fa-circle-xmark',
                dateHeading: 'Ship date',
                showShipVia: false
            },
            'returned-refunded': {
                key: 'returned-refunded',
                title: 'Returned & Refunded',
                description: "Please note that any refunds issued to customers will be deducted from your account's reserve balance. If your reserve balance is insufficient to cover the refund, the amount will be deducted from your future payouts.",
                iconClass: 'fa-solid fa-right-left',
                dateHeading: 'Ship date',
                showShipVia: true
            }
        };

        return configs[view] || configs['unshipped'];
    }

    private resolveSalesChannel(sourcePlatform: string): string {
        return 'NoshCom.com';
    }

    private normalizeStatus(status: string): string {
        return (status || '').trim().toLowerCase().replace(/\s+/g, '');
    }

    private toNumber(value: any): number {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private computeRange(baseDate: Date | null, startOffsetDays: number, endOffsetDays: number): string {
        if (!baseDate) return '-';
        const from = new Date(baseDate);
        from.setDate(baseDate.getDate() + startOffsetDays);
        const to = new Date(baseDate);
        to.setDate(baseDate.getDate() + endOffsetDays);
        return `${from.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} to ${to.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }

    private startClock(): void {
        this.updateClock();
        if (this.clockTimer) {
            clearInterval(this.clockTimer);
        }

        this.zone.runOutsideAngular(() => {
            this.clockTimer = setInterval(() => {
                this.zone.run(() => {
                    this.updateClock();
                    this.cdr.markForCheck();
                });
            }, 1000);
        });
    }

    private updateClock(): void {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const dateFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/New_York',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        this.currentTime = formatter.format(now);
        this.currentDate = dateFormatter.format(now).replace(/ /g, '-');

        const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const hours = ny.getHours();
        const minutes = ny.getMinutes();
        const seconds = ny.getSeconds();
        const hours12 = hours % 12;

        this.hourHandRotation = (hours12 + minutes / 60 + seconds / 3600) * 30;
        this.minuteHandRotation = (minutes + seconds / 60) * 6;
        this.secondHandRotation = seconds * 6;
    }

    private startRelativeTicker(): void {
        this.relativeTimeTimer = setInterval(() => {
            // Force redraw to update timers
            this.cdr.detectChanges();
        }, 1000);
    }
}
