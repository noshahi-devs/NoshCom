import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
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

    isLoading = false;
    searchTerm = '';
    pageSize = 10;
    currentPage = 1;

    orderView: OrderViewKey = 'unshipped';
    viewConfig: OrderViewConfig = this.getViewConfig('unshipped');

    private allOrders: SellerOrderRow[] = [];
    filteredOrders: SellerOrderRow[] = [];

    private routeDataSub: any;
    private relativeTimeTimer: any;
    private nowEpoch = Date.now();

    ngOnInit(): void {
        this.routeDataSub = this.route.data.subscribe((data) => {
            const requestedView = (data?.['orderView'] as OrderViewKey) || 'unshipped';
            this.orderView = requestedView;
            this.viewConfig = this.getViewConfig(requestedView);
            this.currentPage = 1;
            this.applyFilters();
        });

        this.startRelativeTicker();
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
            state: { order: order.source }
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

    getRelativeTime(value: Date | string | null): string {
        if (!value) return '-';
        const date = value instanceof Date ? value : new Date(value);
        const diffMs = Math.max(0, this.nowEpoch - date.getTime());
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (diffMs < minute) return 'just now';
        if (diffMs < hour) {
            const mins = Math.floor(diffMs / minute);
            return `${mins} minute${mins > 1 ? 's' : ''} ago`;
        }
        if (diffMs < day) {
            const hrs = Math.floor(diffMs / hour);
            return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
        }
        if (diffMs < 30 * day) {
            const days = Math.floor(diffMs / day);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
        const months = Math.floor(diffMs / (30 * day));
        return `${months} month${months > 1 ? 's' : ''} ago`;
    }

    formatDate(value: Date | null): string {
        if (!value) return '-';
        return value.toLocaleDateString('en-GB');
    }

    formatTime(value: Date | null): string {
        if (!value) return '-';
        return value.toLocaleTimeString('en-US', { hour12: false });
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
            next: (res) => {
                this.allOrders = (res || []).map((order: any) => this.toRow(order));
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
        const createdAt = order?.creationTime ? new Date(order.creationTime) : null;
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
            source: order
        };
    }

    private matchesCurrentView(statusKey: string): boolean {
        switch (this.orderView) {
            case 'unshipped':
                return statusKey === 'pending' || statusKey === 'processing';
            case 'tracking-verifications':
                return statusKey === 'pendingverification';
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
                title: 'Tracking Verification Pending',
                description: 'Tracking information is being verified. Please allow the system to confirm details.',
                iconClass: 'fa-solid fa-hand',
                dateHeading: 'Ship date',
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
        if (!sourcePlatform) return 'smartstoreus.com';
        return sourcePlatform.toLowerCase() === 'smartstore'
            ? 'smartstoreus.com'
            : `${sourcePlatform.toLowerCase()}.com`;
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

    private startRelativeTicker(): void {
        this.relativeTimeTimer = setInterval(() => {
            this.nowEpoch = Date.now();
            this.cdr.detectChanges();
        }, 60 * 1000);
    }
}
