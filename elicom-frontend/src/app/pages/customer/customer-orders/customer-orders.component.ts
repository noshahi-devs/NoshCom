import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { take } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
    selector: 'app-customer-orders',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './customer-orders.component.html',
    styleUrls: ['./customer-orders.component.scss']
})
export class CustomerOrdersComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private orderService = inject(OrderService);
    private authService = inject(AuthService);
    private cdr = inject(ChangeDetectorRef);

    activeTab = 'All orders';
    tabs = ['All orders', 'Pending', 'Shipped', 'Delivered', 'Cancelled', 'Refund/Return'];

    orders: any[] = [];
    isLoading = false;
    isLoadingMore = false;
    pageSize = 10;
    skipCount = 0;
    totalCount = 0;

    showOrderModal = false;
    detailLoading = false;
    selectedOrder: any = null;

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            let status = params['status'];
            if (status) {
                if (status.toLowerCase() === 'return') {
                    status = 'Refund/Return';
                }
                const match = this.tabs.find(t => t.toLowerCase() === status.toLowerCase());
                if (match) {
                    this.activeTab = match;
                }
            } else {
                this.activeTab = 'All orders';
            }
            this.loadOrders(true);
        });
    }

    loadOrders(reset: boolean) {
        if (reset) {
            this.isLoading = true;
            this.skipCount = 0;
            this.totalCount = 0;
            this.orders = [];
            this.cdr.detectChanges();
        } else {
            this.isLoadingMore = true;
            this.cdr.detectChanges();
        }

        this.authService.currentUser$.pipe(take(1)).subscribe(user => {
            if (!user?.id) {
                this.isLoading = false;
                this.isLoadingMore = false;
                this.cdr.detectChanges();
                return;
            }

            this.orderService.getCustomerOrdersPaged({
                status: this.getStatusFilter(),
                skipCount: this.skipCount,
                maxResultCount: this.pageSize
            }).subscribe({
                next: (res) => {
                    const items = res?.items || [];
                    if (reset) {
                        this.orders = items;
                    } else {
                        this.orders = [...this.orders, ...items];
                    }
                    this.totalCount = res?.totalCount ?? this.orders.length;
                    this.skipCount += items.length;
                    this.isLoading = false;
                    this.isLoadingMore = false;
                    this.cdr.detectChanges();
                },
                error: () => {
                    this.isLoading = false;
                    this.isLoadingMore = false;
                    this.cdr.detectChanges();
                }
            });
        });
    }

    getStatusFilter(): string | undefined {
        if (this.activeTab === 'All orders') return undefined;
        if (this.activeTab === 'Refund/Return') return 'Return';
        return this.activeTab;
    }

    showMore() {
        if (this.isLoadingMore || this.isLoading) return;
        if (this.orders.length >= this.totalCount) return;
        this.loadOrders(false);
    }

    openOrderDetails(orderId: string) {
        if (!orderId) return;
        this.showOrderModal = true;
        this.detailLoading = true;
        this.selectedOrder = null;
        this.cdr.detectChanges();

        this.orderService.getOrder(orderId).subscribe({
            next: (order) => {
                this.selectedOrder = order;
                this.detailLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.detailLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    closeOrderDetails() {
        this.showOrderModal = false;
        this.selectedOrder = null;
        this.cdr.detectChanges();
    }

    getOrderNumber(order: any): string {
        return order?.orderNumber || order?.id || '';
    }

    getOrderProductName(order: any): string {
        return order?.productName || order?.orderItems?.[0]?.productName || '';
    }

    getOrderStoreName(order: any): string {
        return order?.storeName || order?.orderItems?.[0]?.storeName || '';
    }

    getItemProductName(item: any): string {
        return item?.productName || item?.name || 'Product';
    }

    getItemStoreName(item: any): string {
        return item?.storeName || '';
    }

    getItemLineTotal(item: any): number {
        return (item?.priceAtPurchase || 0) * (item?.quantity || 0);
    }

    getPaymentMethodLabel(method: string | undefined): string {
        const normalized = String(method || '').trim().toLowerCase();

        if (!normalized) {
            return 'N/A';
        }

        if (normalized.includes('finora')) {
            return 'Nosh Pay';
        }

        return method || 'N/A';
    }

    getPaymentStatusLabel(order: any): string {
        const status = order?.paymentStatus || 'Pending';
        const method = this.getPaymentMethodLabel(order?.paymentMethod);

        if (method === 'Nosh Pay' && String(status).toLowerCase() === 'paid') {
            return 'Paid by Nosh Pay';
        }

        return status;
    }

    openStoreProducts(storeName: string, event?: Event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const name = (storeName || '').trim();
        if (!name) return;

        this.router.navigate(['/search-result'], { queryParams: { q: name } });
    }

    resolveImage(path: string | undefined): string {
        const normalizedPath = this.normalizeImagePath(path);
        if (!normalizedPath) return 'https://via.placeholder.com/60';
        if (normalizedPath.startsWith('http')) return normalizedPath;
        if (normalizedPath.startsWith('//')) return `https:${normalizedPath}`;
        // normalize double slashes
        const normalized = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
        return `${environment.apiUrl}/${normalized}`;
    }

    handleImgError(event: Event) {
        const el = event.target as HTMLImageElement;
        if (!el) return;
        el.src = 'https://via.placeholder.com/60';
    }

    private normalizeImagePath(path: string | undefined): string {
        if (!path) return '';
        let value = path.replace(/[\r\n\t]/g, '').trim();
        if (!value) return '';

        if (value.startsWith('[')) {
            try {
                const arr = JSON.parse(value);
                if (Array.isArray(arr) && arr.length > 0) {
                    value = String(arr[0] ?? '');
                }
            } catch {
                // keep original value
            }
        }

        if (value.startsWith('"') && value.endsWith('"')) {
            try {
                value = JSON.parse(value);
            } catch {
                value = value.slice(1, -1);
            }
        }

        value = value.replace(/^\\+/, '').trim();
        value = value.replace(/^["']+|["']+$/g, '').trim();
        return value;
    }
}
