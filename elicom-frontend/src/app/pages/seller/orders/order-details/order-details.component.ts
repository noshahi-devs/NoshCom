import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { catchError, finalize, throwError, timeout } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../../services/order.service';
import { AlertService } from '../../../../services/alert.service';
import { AuthService } from '../../../../services/auth.service';
import { StoreService } from '../../../../services/store.service';
import { environment } from '../../../../../environments/environment';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-order-details',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './order-details.component.html',
    styleUrls: ['./order-details.component.scss']
})
export class OrderDetailsComponent implements OnInit {
    order: any = null;
    carriers: any[] = [];
    fulfillmentForm = {
        shipmentDate: new Date().toISOString().split('T')[0],
        carrierId: '',
        trackingCode: ''
    };
    fulfilling = false;
    fromView: string | null = null;

    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private orderService = inject(OrderService);
    private storeService = inject(StoreService);
    private cdr = inject(ChangeDetectorRef);
    private alertService = inject(AlertService);
    authService = inject(AuthService);

    ngOnInit() {
        const orderId = this.route.snapshot.paramMap.get('id');
        const state = window.history.state;

        if (state && state.order && state.order.orderItems) {
            this.fromView = state.fromView || null;
            this.mapOrderData(state.order);
        } else if (orderId) {
            this.fromView = state?.fromView || null;
            this.loadOrderDetails(orderId);
        }
    }

    loadOrderDetails(id: string) {
        // Check if ID is a GUID
        const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        
        const observable = isGuid 
            ? this.orderService.getOrder(id)
            : this.orderService.getByOrderNumber(id);

        observable.subscribe({
            next: (res: any) => {
                this.mapOrderData(res);
            },
            error: (err: any) => {
                console.error('Failed to load order details', err);
                const message = err?.error?.error?.message || err?.message || 'Order not found';
                this.alertService.error(message);
            }
        });
    }

    mapOrderData(data: any) {
        const creationDate = data.creationTime ? new Date(data.creationTime) : new Date();

        // Mocking Ship By: +1 to +2 days
        const shipByFrom = new Date(creationDate); shipByFrom.setDate(creationDate.getDate() + 1);
        const shipByTo = new Date(creationDate); shipByTo.setDate(creationDate.getDate() + 2);

        // Mocking Deliver By: +3 to +7 days
        const deliverByFrom = new Date(creationDate); deliverByFrom.setDate(creationDate.getDate() + 3);
        const deliverByTo = new Date(creationDate); deliverByTo.setDate(creationDate.getDate() + 7);

        const platformFeeRate = 0.08; // 8% platform fee deducted from item subtotal
        const itemsTotal = data.subTotal || 0;
        const platformFeeAmount = itemsTotal * platformFeeRate;
        const netPayoutAmount = Math.max(0, itemsTotal - platformFeeAmount);

        // Map backend DTO to template names
        this.order = {
            ...data,
            id: data.id, // KEEP REAL GUID
            displayId: data.orderNumber || data.id,
            date: creationDate.toLocaleDateString(),
            fullDateTime: creationDate.toLocaleString(),
            uiPurchaseDate: this.formatDateForUI(creationDate),
            uiPurchaseTime: this.formatTimeForUI(creationDate),
            shipBy: this.formatShipByRange(creationDate, 1, 2),
            deliverBy: this.formatShipByRange(creationDate, 3, 7),
            customer: data.recipientName || data.customerName || ('User #' + data.userId),
            phone: data.recipientPhone || data.phone || 'N/A',
            email: data.recipientEmail || data.email || 'N/A',
            subtotal: itemsTotal,
            shippingFee: data.shippingCost || 0,
            platformFee: platformFeeAmount,
            taxAmount: itemsTotal * 0.04, // Mock 4% tax from screenshot
            platformFeeRatePercent: (platformFeeRate * 100),
            payoutAmount: netPayoutAmount,
            grandTotal: itemsTotal + (itemsTotal * 0.04), // subtotal + tax
            shippingService: 'Standard',
            fulfillment: 'Seller',
            salesChannel: 'WorldCart.com',
            sellerInfo: {
                sellerName: this.asDisplayValue(data.sellerName),
                sellerId: this.asDisplayValue(data.sellerId),
                sellerEmail: this.asDisplayValue(data.sellerEmail),
                storeName: this.asDisplayValue(data.sellerStoreName || data.orderItems?.[0]?.storeName),
                storeId: this.asDisplayValue(data.sellerStoreId)
            },
            primeShipInfo: {
                sourceOrderId: data.primeShipOrderId || data.supplierReference || data.orderNumber || data.id || 'N/A',
                trackingNumber: data.primeShipTrackingNumber || data.trackingCode || data.deliveryTrackingNumber || 'N/A',
                purchaseDateTime: creationDate,
                shipmentDate: data.shipmentDate ? new Date(data.shipmentDate) : null,
                carrier: data.carrierId || 'N/A'
            },
            orderItems: (data.orderItems || []).map((item: any) => {
                const itemSubtotal = item.priceAtPurchase * item.quantity;
                const itemPlatformFee = itemSubtotal * platformFeeRate;
                const itemNetPayout = Math.max(0, itemSubtotal - itemPlatformFee);
                const itemTax = itemSubtotal * 0.04;
                return {
                    id: item.id,
                    name: item.productName,
                    sku: item.productId?.substring(0, 8).toUpperCase() || 'N/A',
                    productId: item.productId,
                    price: item.priceAtPurchase,
                    quantity: item.quantity,
                    subtotal: itemSubtotal.toFixed(2),
                    tax: itemTax.toFixed(2),
                    platformFee: itemPlatformFee.toFixed(2),
                    total: (itemSubtotal + itemTax).toFixed(2),
                    image: this.resolveProductImage(item.imageUrl)
                };
            })
        };


        this.order.statusLabel = this.order.status;
        if (this.fromView === 'tracking-verifications') {
            if (this.order.status === 'Shipped' || this.order.status === 'ShippedFromHub') {
                this.order.statusLabel = 'Pending Verification';
            }
        }

        // Fallback for environments where seller meta fields are not yet deployed in backend.
        this.hydrateSellerInfoFallback();
        this.cdr.detectChanges();
    }

    private asDisplayValue(value: any): string {
        if (value === null || value === undefined) return 'N/A';
        const text = String(value).trim();
        return text ? text : 'N/A';
    }

    private needsSellerFallback(): boolean {
        const seller = this.order?.sellerInfo;
        if (!seller) return true;
        return seller.sellerName === 'N/A'
            || seller.sellerId === 'N/A'
            || seller.sellerEmail === 'N/A'
            || seller.storeId === 'N/A';
    }

    private hydrateSellerInfoFallback(): void {
        if (!this.order || !this.needsSellerFallback()) return;

        const storeName = this.order?.sellerInfo?.storeName;
        if (!storeName || storeName === 'N/A') return;

        this.storeService.getAllStores().subscribe({
            next: (res: any) => {
                const stores = this.extractStores(res);
                if (!stores.length) return;

                const matched = stores.find((s: any) =>
                    String(s?.name || '').trim().toLowerCase() === String(storeName).trim().toLowerCase()
                );

                if (!matched) return;

                this.order.sellerInfo = {
                    sellerName: this.asDisplayValue(
                        this.order?.sellerInfo?.sellerName !== 'N/A'
                            ? this.order?.sellerInfo?.sellerName
                            : (matched?.kyc?.fullName || `Seller #${matched?.ownerId || ''}`)
                    ),
                    sellerId: this.asDisplayValue(
                        this.order?.sellerInfo?.sellerId !== 'N/A'
                            ? this.order?.sellerInfo?.sellerId
                            : matched?.ownerId
                    ),
                    sellerEmail: this.asDisplayValue(
                        this.order?.sellerInfo?.sellerEmail !== 'N/A'
                            ? this.order?.sellerInfo?.sellerEmail
                            : (matched?.supportEmail || matched?.kyc?.email || null)
                    ),
                    storeName: this.asDisplayValue(matched?.name || this.order?.sellerInfo?.storeName),
                    storeId: this.asDisplayValue(
                        this.order?.sellerInfo?.storeId !== 'N/A'
                            ? this.order?.sellerInfo?.storeId
                            : matched?.id
                    )
                };

                this.cdr.detectChanges();
            },
            error: (err) => {
                console.warn('Seller info fallback load failed', err);
            }
        });
    }

    private extractStores(res: any): any[] {
        const result = res?.result ?? res;
        if (Array.isArray(result)) return result;
        if (Array.isArray(result?.items)) return result.items;
        if (Array.isArray(res?.items)) return res.items;
        return [];
    }

    formatPanelDateTime(value: Date | string | null | undefined): string {
        if (!value) return 'N/A';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    private resolveProductImage(rawValue: string | undefined): string {
        const fallback = 'assets/images/card_1.jpg';
        if (!rawValue || rawValue === 'string') return fallback;

        let val = rawValue.toString().trim();
        if (!val) return fallback;

        // Handle JSON-ish strings like ["url1","url2"] or quoted URL strings
        val = val.replace(/^\["/, '').replace(/"\]$/, '').replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '');
        if (val.includes('","')) {
            val = val.split('","')[0];
        } else if (val.includes(',')) {
            val = val.split(',')[0];
        }

        val = val.trim();
        if (!val) return fallback;

        if (val.startsWith('http://') || val.startsWith('https://')) {
            return val;
        }

        if (val.startsWith('/')) {
            val = val.substring(1);
        }

        return `${environment.apiUrl}/${val}`;
    }

    onProductImageError(event: Event) {
        const img = event.target as HTMLImageElement;
        if (!img) return;
        img.src = 'assets/images/card_1.jpg';
    }

    statusOptions = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    updatingStatus = false;

    private normalizedStatus(): string {
        return (this.order?.status || '').toString().trim().toLowerCase();
    }

    isCancelledStatus(): boolean {
        const status = this.normalizedStatus();
        return status === 'cancelled' || status === 'canceled';
    }

    isRejectedStatus(): boolean {
        return this.normalizedStatus() === 'rejected';
    }

    canVerifyStatus(status: any): boolean {
        const normalized = (status ?? '').toString().trim().toLowerCase();
        return normalized === 'pendingverification'
            || normalized === 'shipped'
            || normalized === 'shippedfromhub'
            || normalized === 'pending'
            || normalized === 'processing';
    }

    canShowFulfillmentPanel(): boolean {
        if (this.authService.isAdmin()) return false;
        const status = this.normalizedStatus();
        return status === 'pending' || status === 'processing' || status === 'cancelled' || status === 'canceled';
    }

    shipActionLabel(): string {
        return this.isCancelledStatus() ? 'Ship Again' : 'Confirm & Ship';
    }

    updateStatus(newStatus: string) {
        if (!this.order?.guid && !this.order?.id) return;

        this.updatingStatus = true;
        const id = this.order.guid || this.order.id;

        this.orderService.updateOrderStatus(id, newStatus).subscribe({
            next: (res) => {
                this.updatingStatus = false;
                this.order.status = newStatus;
                this.alertService.success(`Order status updated to ${newStatus}`);
            },
            error: (err: any) => {
                this.updatingStatus = false;
                console.error('Failed to update status', err);
                this.alertService.error('Failed to update order status');
            }
        });
    }

    fulfillOrder() {
        if (!this.order?.id) return;
        if (this.isRejectedStatus()) {
            this.alertService.error('Rejected order cannot be shipped again.');
            return;
        }

        if (!this.fulfillmentForm.carrierId || !this.fulfillmentForm.trackingCode) {
            alert('Please fill all shipment details');
            return;
        }

        this.fulfilling = true;
        const id = this.order.guid || this.order.id;

        const input = {
            id: id,
            ...this.fulfillmentForm
        };

        this.orderService.fulfillOrder(input).pipe(
            timeout(15000),
            finalize(() => {
                this.fulfilling = false;
            }),
            catchError((err) => {
                console.error('Fulfillment error', err);
                this.alertService.error('Failed to fulfill order');
                return throwError(() => err);
            })
        ).subscribe({
            next: () => {
                const wasCancelledBeforeShip = this.isCancelledStatus();
                // Backend sets 'Shipped' for sellers in Fulfill method
                this.order.status = 'Shipped';
                const successMessage = wasCancelledBeforeShip
                    ? 'Cancelled order moved back to shipping flow successfully.'
                    : 'Order fulfilled successfully! Tracking information submitted for verification.';
                this.alertService
                    .success(successMessage)
                    .then(() => {
                        this.router.navigate(['/seller/orders']);
                    });
            }
        });
    }

    cancelOrder() {
        const id = this.order.guid || this.order.id;
        if (this.isRejectedStatus()) {
            this.alertService.error('Rejected order cannot be cancelled again.');
            return;
        }

        this.alertService.confirm(`Are you sure you want to cancel order ${this.order.id}? This will refund the payment to the customer.`).then((result) => {
            if (result.isConfirmed) {
                this.orderService.cancelOrder(id).subscribe({
                    next: () => {
                        this.order.status = 'Cancelled';
                        this.alertService.success('Order has been cancelled successfully.');
                    },
                    error: (err) => {
                        console.error('Failed to cancel order', err);
                        this.alertService.error('Failed to cancel order: ' + (err.error?.message || 'Unknown error'));
                    }
                });
            }
        });
    }

    rejectOrder() {
        const id = this.order.guid || this.order.id;
        if (!id) return;

        this.alertService.confirm(
            `Reject order ${this.order.id}? After rejection it cannot be shipped again.`,
            'REJECT ORDER'
        ).then((result) => {
            if (!result.isConfirmed) return;

            this.orderService.rejectOrder(id).subscribe({
                next: () => {
                    this.order.status = 'Rejected';
                    this.alertService.success('Order rejected successfully. Shipping is now locked for this order.');
                },
                error: (err) => {
                    console.error('Failed to reject order', err);
                    const message = err?.error?.error?.message || err?.error?.message || err?.message || 'Unknown error';
                    this.alertService.error('Failed to reject order: ' + message);
                }
            });
        });
    }

    verifyOrder() {
        const id = this.order.guid || this.order.id;
        if (!this.canVerifyStatus(this.order?.status)) {
            this.alertService.info('Order is not in verification stage.');
            return;
        }

        this.alertService.confirm('Verify tracking information for this order?', 'CONFIRM VERIFICATION').then(result => {
            if (result.isConfirmed) {
                this.orderService.verifyOrder(id).subscribe({
                    next: () => {
                        this.alertService.success('Order verified. Transactions created.');
                        this.loadOrderDetails(id);
                    },
                    error: (err) => {
                        const message = err?.error?.error?.message || err?.error?.message || err?.message || 'Verification failed';
                        this.alertService.error(message);
                    }
                });
            }
        });
    }

    deliverOrder() {
        const id = this.order.guid || this.order.id;
        if ((this.order?.status ?? '').toString().trim().toLowerCase() !== 'verified') {
            this.alertService.info('Order must be verified before delivery confirmation.');
            return;
        }

        this.alertService.confirm('Confirm delivery and release funds to seller?', 'CONFIRM DELIVERY').then(result => {
            if (result.isConfirmed) {
                this.orderService.deliverOrder(id).subscribe({
                    next: () => {
                        this.alertService.success('Order marked as Delivered. Funds have been released to the seller.');
                        this.loadOrderDetails(id);
                    },
                    error: (err) => {
                        const message = err?.error?.error?.message || err?.error?.message || err?.message || 'Delivery confirmation failed';
                        this.alertService.error(message);
                    }
                });
            }
        });
    }

    private formatDateForUI(date: Date): string {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric'
        });
    }

    private formatTimeForUI(date: Date): string {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    private formatShipByRange(creationDate: Date, startDays: number, endDays: number): string {
        const start = new Date(creationDate);
        start.setDate(creationDate.getDate() + startDays);
        const end = new Date(creationDate);
        end.setDate(creationDate.getDate() + endDays);
        return `${this.formatDateForUI(start)} to ${this.formatDateForUI(end)}`;
    }

    goBack() {

        if (this.authService.isAdmin() && this.router.url.includes('/admin/')) {
            this.router.navigate(['/admin/orders']);
        } else {
            this.router.navigate(['/seller/orders']);
        }
    }
}
