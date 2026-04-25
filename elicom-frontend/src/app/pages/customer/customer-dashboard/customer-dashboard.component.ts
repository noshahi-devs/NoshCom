import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { OrderService } from '../../../services/order.service';
import { WalletService } from '../../../services/wallet.service';
import { take } from 'rxjs';

@Component({
    selector: 'app-customer-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './customer-dashboard.component.html',
    styleUrls: ['./customer-dashboard.component.scss']
})
export class CustomerDashboardComponent implements OnInit {
    userName = 'prismaticadeel';
    totalSpend = 0;
    orderProgress = 0;
    currentStep = 0;
    orderStatus = 'No active orders';
    trackingSteps = ['Order placed', 'Processing', 'Shipped', 'Delivered'];

    orderStatuses = [
        { label: 'Pending', icon: 'fa-clock', count: 0 },
        { label: 'Shipped', icon: 'fa-truck', count: 0 },
        { label: 'Delivered', icon: 'fa-check-double', count: 0 },
        { label: 'Cancelled', icon: 'fa-xmark', count: 0 },
        { label: 'Return', icon: 'fa-rotate-left', count: 0 }
    ];

    assets = [
        { label: 'Coupons', value: '3', unit: '' },
        { label: 'Points', value: '150', unit: '' },
        { label: 'Wallet', value: '25.00', unit: '$' },
        { label: 'Gift Card', value: '0', unit: '' }
    ];

    readonly shoppingSignals = [
        { label: 'Style Match', value: '98%', tone: 'dark' },
        { label: 'Fast Delivery', value: '24H', tone: 'light' },
        { label: 'Member Rewards', value: 'VIP', tone: 'outline' }
    ];

    readonly experienceNotes = [
        {
            title: 'Track every order',
            description: 'Follow your package from checkout to doorstep with live progress updates.',
            icon: 'fa-cube'
        },
        {
            title: 'Manage rewards',
            description: 'Keep your coupons, wallet balance, and loyalty points in one polished view.',
            icon: 'fa-sparkles'
        },
        {
            title: 'Jump back to shopping',
            description: 'Move from account overview to curated discovery in a single tap.',
            icon: 'fa-bag-shopping'
        }
    ];

    constructor(
        private authService: AuthService,
        private orderService: OrderService,
        private walletService: WalletService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadUserData();
        this.loadOrders();
        this.loadWallet();
    }

    loadUserData() {
        this.authService.currentUser$.subscribe(user => {
            if (user) {
                // Use name or userName as fallback
                this.userName = user.name || user.userName || 'User';
            }
        });
    }

    loadWallet() {
        this.walletService.getMyWallet().subscribe({
            next: (wallet) => {
                if (wallet) {
                    const walletAsset = this.assets.find(a => a.label === 'Wallet');
                    if (walletAsset) {
                        walletAsset.value = wallet.balance.toFixed(2);
                        walletAsset.unit = wallet.currency === 'USD' ? '$' : wallet.currency;
                    }
                }
            },
            error: (err) => {
                console.warn('Failed to load wallet balance', err);
            }
        });
    }

    loadOrders() {
        this.orderService.getCustomerOrdersPaged({
            skipCount: 0,
            maxResultCount: 200
        }).subscribe({
            next: (res) => {
                const orders = this.extractOrdersFromPagedResponse(res);
                if (orders.length > 0) {
                    this.applyOrderStats(orders);
                    return;
                }
                this.loadOrdersFallbackByUserId();
            },
            error: () => this.loadOrdersFallbackByUserId()
        });
    }

    private loadOrdersFallbackByUserId(): void {
        this.authService.currentUser$.pipe(take(1)).subscribe(user => {
            const numericUserId = Number(user?.id);
            if (Number.isNaN(numericUserId) || numericUserId <= 0) {
                this.applyOrderStats([]);
                return;
            }

            this.orderService.getCustomerOrders(numericUserId).subscribe({
                next: (fallbackOrders) => this.applyOrderStats(Array.isArray(fallbackOrders) ? fallbackOrders : []),
                error: () => this.applyOrderStats([])
            });
        });
    }

    private applyOrderStats(orders: any[]): void {
        this.totalSpend = this.calculateTotalSpend(orders);
        this.updateTrackingFromOrders(orders);

        const pending = orders.filter(o => this.isPendingStatus(this.normalizeStatus(o))).length;
        const shipped = orders.filter(o => this.isShippedStatus(this.normalizeStatus(o))).length;
        const delivered = orders.filter(o => this.isDeliveredStatus(this.normalizeStatus(o))).length;
        const cancelled = orders.filter(o => this.isCancelledStatus(this.normalizeStatus(o))).length;
        const returns = orders.filter(o => this.isReturnStatus(this.normalizeStatus(o))).length;

        this.orderStatuses = [
            { label: 'Pending', icon: 'fa-clock', count: pending },
            { label: 'Shipped', icon: 'fa-truck', count: shipped },
            { label: 'Delivered', icon: 'fa-check-double', count: delivered },
            { label: 'Cancelled', icon: 'fa-xmark', count: cancelled },
            { label: 'Return', icon: 'fa-rotate-left', count: returns }
        ];
    }

    private extractOrdersFromPagedResponse(res: any): any[] {
        if (Array.isArray(res?.items)) return res.items;
        if (Array.isArray(res?.items?.$values)) return res.items.$values;
        if (Array.isArray(res?.result?.items)) return res.result.items;
        if (Array.isArray(res?.result?.items?.$values)) return res.result.items.$values;
        if (Array.isArray(res?.result?.$values)) return res.result.$values;
        return [];
    }

    private normalizeStatus(order: any): string {
        const raw = String(
            order?.status ||
            order?.orderStatus ||
            order?.statusName ||
            ''
        ).trim().toLowerCase();
        return raw.replace(/[\s_-]+/g, '');
    }

    private isPendingStatus(status: string): boolean {
        return ['pending', 'unpaid', 'processing', 'inprogress', 'awaiting', 'awaitingpayment'].includes(status);
    }

    private isShippedStatus(status: string): boolean {
        return ['shipped', 'shippedfromhub', 'intransit', 'verified'].includes(status);
    }

    private isDeliveredStatus(status: string): boolean {
        return ['delivered', 'completed', 'received'].includes(status);
    }

    private isCancelledStatus(status: string): boolean {
        return ['cancelled', 'canceled', 'rejected'].includes(status);
    }

    private isReturnStatus(status: string): boolean {
        return ['return', 'returned', 'refunded', 'refund', 'returnrequested'].includes(status);
    }

    private calculateTotalSpend(orders: any[]): number {
        if (!orders || orders.length === 0) return 0;
        return orders.reduce((sum, order) => {
            const value = order?.totalAmount || order?.grandTotal || order?.totalPrice || order?.amount || 0;
            return sum + Number(value || 0);
        }, 0);
    }

    private updateTrackingFromOrders(orders: any[]) {
        if (!orders || orders.length === 0) {
            this.orderStatus = 'No active orders';
            this.orderProgress = 0;
            this.currentStep = 0;
            return;
        }

        const latestOrder = [...orders].sort((a, b) => {
            const aTime = new Date(a?.creationTime || 0).getTime();
            const bTime = new Date(b?.creationTime || 0).getTime();
            return bTime - aTime;
        })[0];

        const status = this.normalizeStatus(latestOrder);
        const statusMap: Record<string, { progress: number; step: number; label: string }> = {
            unpaid: { progress: 15, step: 0, label: 'Awaiting payment' },
            pending: { progress: 30, step: 0, label: 'Pending' },
            processing: { progress: 45, step: 1, label: 'Processing' },
            shipped: { progress: 75, step: 2, label: 'Shipped' },
            shippedfromhub: { progress: 75, step: 2, label: 'Shipped' },
            intransit: { progress: 75, step: 2, label: 'Shipped' },
            verified: { progress: 75, step: 2, label: 'Shipped' },
            delivered: { progress: 100, step: 3, label: 'Delivered' },
            completed: { progress: 100, step: 3, label: 'Delivered' },
            cancelled: { progress: 0, step: 0, label: 'Cancelled' },
            canceled: { progress: 0, step: 0, label: 'Cancelled' },
            returned: { progress: 0, step: 0, label: 'Returned' },
            return: { progress: 0, step: 0, label: 'Returned' },
            refunded: { progress: 0, step: 0, label: 'Returned' },
        };

        const mapped = statusMap[status] || statusMap['processing'];
        this.orderProgress = mapped.progress;
        this.currentStep = mapped.step;
        this.orderStatus = mapped.label;
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/']);
    }

    goShopping() {
        window.location.href = '/';
    }

    get totalOrders(): number {
        return this.orderStatuses.reduce((sum, status) => sum + status.count, 0);
    }

    get activeOrders(): number {
        return this.orderStatuses
            .filter(status => ['Pending', 'Shipped'].includes(status.label))
            .reduce((sum, status) => sum + status.count, 0);
    }

    get deliveredOrders(): number {
        return this.orderStatuses.find(status => status.label === 'Delivered')?.count ?? 0;
    }

    get walletAsset() {
        return this.assets.find(asset => asset.label === 'Wallet') ?? this.assets[0];
    }

    get pointsAsset() {
        return this.assets.find(asset => asset.label === 'Points') ?? this.assets[0];
    }

    get completionRate(): number {
        if (!this.totalOrders) {
            return 0;
        }

        return Math.round((this.deliveredOrders / this.totalOrders) * 100);
    }

    get loyaltyTier(): string {
        if (this.totalSpend >= 5000) {
            return 'Black Elite';
        }

        if (this.totalSpend >= 2000) {
            return 'Gold Plus';
        }

        if (this.totalSpend >= 500) {
            return 'Rising Star';
        }

        return 'Fresh Member';
    }
}
