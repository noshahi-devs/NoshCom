import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { AlertService } from '../../../services/alert.service';

@Component({
    selector: 'app-admin-orders',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './admin-orders.component.html',
    styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit {
    orders: any[] = [];
    currentTab: 'PendingVerification' | 'Verified' | 'Delivered' = 'PendingVerification';
    searchTerm = '';
    pageSize = 10;
    currentPage = 1;
    loading = false;
    selectedOrder: any = null;
    showTrackingModal = false;

    private orderService = inject(OrderService);
    private cdr = inject(ChangeDetectorRef);
    private alertService = inject(AlertService);

    ngOnInit() {
        this.loadOrders();
    }

    loadOrders() {
        this.loading = true;
        this.orderService.getAllOrders().subscribe({
            next: (res) => {
                this.orders = res;
                this.loading = false;
                this.currentPage = 1;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to load orders', err);
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private normalizeStatus(status: any): string {
        return String(status ?? '').trim().toLowerCase();
    }

    isPendingVerificationStatus(status: any): boolean {
        const normalized = this.normalizeStatus(status);
        return normalized === 'pending'
            || normalized === 'pendingverification'
            || normalized === 'shipped'
            || normalized === 'shippedfromhub'
            || normalized === 'processing';
    }

    isVerifiedStatus(status: any): boolean {
        return this.normalizeStatus(status) === 'verified';
    }

    isDeliveredStatus(status: any): boolean {
        const normalized = this.normalizeStatus(status);
        return normalized === 'delivered' || normalized === 'completed';
    }

    canVerify(order: any): boolean {
        return this.isPendingVerificationStatus(order?.status);
    }

    get tabFilteredOrders() {
        let filtered: any[] = [];
        if (this.currentTab === 'PendingVerification') {
            filtered = this.orders.filter(o => this.isPendingVerificationStatus(o?.status));
        } else if (this.currentTab === 'Verified') {
            filtered = this.orders.filter(o => this.isVerifiedStatus(o?.status));
        } else {
            filtered = this.orders.filter(o => this.isDeliveredStatus(o?.status));
        }

        // Always sort by creationTime descending (newest first)
        return filtered.sort((a, b) => {
            const timeA = a.creationTime ? new Date(a.creationTime).getTime() : 0;
            const timeB = b.creationTime ? new Date(b.creationTime).getTime() : 0;
            return timeB - timeA;
        });
    }

    get filteredOrders() {
        const term = this.searchTerm.trim().toLowerCase();
        if (!term) return this.tabFilteredOrders;

        return this.tabFilteredOrders.filter(order => {
            const haystack = [
                order?.orderNumber,
                order?.customerName,
                order?.userId,
                order?.totalAmount,
                order?.carrierId,
                order?.trackingCode,
                order?.status
            ]
                .map(value => String(value ?? '').toLowerCase())
                .join(' ');
            return haystack.includes(term);
        });
    }

    get pagedOrders() {
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
        return Math.min(this.currentPage * this.pageSize, this.filteredOrders.length);
    }

    setTab(tab: 'PendingVerification' | 'Verified' | 'Delivered') {
        this.currentTab = tab;
        this.currentPage = 1;
    }

    onSearchChange() {
        this.currentPage = 1;
    }

    goPrevious() {
        if (this.currentPage > 1) {
            this.currentPage -= 1;
        }
    }

    goNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage += 1;
        }
    }

    getStatusClass(status: any): string {
        if (this.isPendingVerificationStatus(status)) return 'badge-unshipped';
        if (this.isVerifiedStatus(status)) return 'badge-verified';
        if (this.isDeliveredStatus(status)) return 'badge-delivered';
        return 'badge-default';
    }

    getStatusLabel(status: any): string {
        if (this.isPendingVerificationStatus(status)) return 'Pending Verification';
        if (this.isVerifiedStatus(status)) return 'Verified';
        if (this.isDeliveredStatus(status)) return 'Delivered';
        return String(status || 'Unknown');
    }

    openTrackingModal(order: any) {
        this.selectedOrder = order;
        this.showTrackingModal = true;
        this.cdr.detectChanges();
    }

    closeTrackingModal() {
        this.showTrackingModal = false;
        this.selectedOrder = null;
        this.cdr.detectChanges();
    }

    resolveOrderId(order: any): string | null {
        const candidates = [
            order?.id,
            order?.orderId,
            order?.guid,
            order?.orderGuid,
            order?.orderItems?.[0]?.orderId,
            order?.orderItems?.[0]?.id
        ];
        for (const value of candidates) {
            if (typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
                return value;
            }
        }
        return typeof order?.id === 'string' ? order.id : null;
    }

    verifyOrder(order: any) {
        if (!this.canVerify(order)) {
            this.alertService.info('This order is no longer in verification stage.');
            return;
        }

        const id = this.resolveOrderId(order);
        if (!id) {
            this.alertService.error('Invalid order id for verification.');
            return;
        }
        this.alertService.confirm('Verify tracking information for this order?', 'CONFIRM VERIFICATION').then(result => {
            if (result.isConfirmed) {
                this.orderService.verifyOrder(id).subscribe({
                    next: () => {
                        this.alertService.success('Order verified. Transactions created.');
                        this.loadOrders();
                    },
                    error: (err) => {
                        const message = err?.error?.error?.message || err?.error?.message || err?.message || 'Verification failed';
                        this.alertService.error(message);
                    }
                });
            }
        });
    }

    deliverOrder(order: any) {
        if (!this.isVerifiedStatus(order?.status)) {
            this.alertService.info('Only verified orders can be delivered.');
            return;
        }

        const id = this.resolveOrderId(order);
        if (!id) {
            this.alertService.error('Invalid order id for delivery confirmation.');
            return;
        }
        this.alertService.confirm('Confirm delivery and release funds to seller?', 'CONFIRM DELIVERY').then(result => {
            if (result.isConfirmed) {
                this.orderService.deliverOrder(id).subscribe({
                    next: () => {
                        this.alertService.success('Order marked as Delivered. Funds have been released to the seller.');
                        this.loadOrders();
                    },
                    error: (err) => {
                        const message = err?.error?.error?.message || err?.error?.message || err?.message || 'Delivery confirmation failed';
                        this.alertService.error(message);
                    }
                });
            }
        });
    }
}
