import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { ProductService } from '../../../core/services/product.service';
import { CartService, CartItem } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PrimeIcons } from 'primeng/api';

type OrderStatus = 'pending' | 'verified' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'purchased' | 'settled';

interface OrderItem {
  name?: string;
  productName?: string;
  qty: number;
  price?: number;
  purchasePrice?: number;
}

interface Order {
  id: number;
  orderNo: string;
  customerName: string;
  phone: string;
  address: string;
  status: OrderStatus;
  createdAt: Date;
  items: OrderItem[];
  sellerEarnings?: number;
  sellerId?: number;
}

@Component({
  selector: 'app-seller-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class SellerOrdersComponent implements OnInit {
  orders: any[] = [];
  filteredOrders: any[] = [];
  skuSearchTerm = '';
  foundProduct: any = null;
  statusMenuOpen = false;
  readonly statusOptions: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All Orders' },
    { value: 'pending', label: 'Pending Review' },
    { value: 'verified', label: 'Verified' },
    { value: 'processing', label: 'In Progress' },
    { value: 'shipped', label: 'On the Way' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ] as const;

  constructor(
    private orderService: OrderService,
    private productService: ProductService,
    private cartService: CartService,
    private toastService: ToastService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  searchTerm = '';
  selectedStatus = 'all';

  viewModalVisible = false;
  selectedOrder: any = null;

  addOrderModalVisible = false;
  newOrder = {
    customerName: '',
    phone: '',
    address: '',
    items: [{ name: '', productId: '', qty: 1, price: 0 }]
  };

  deleteConfirmVisible = false;
  orderToDelete: any = null;
  createConfirmVisible = false;
  successPopupVisible = false;
  successMessage = '';
  errorPopupVisible = false;
  errorMessage = '';

  sellerStats = {
    totalOrders: 0,
    totalEarnings: 0,
    pendingOrders: 0,
    deliveredOrders: 0
  };

  ngOnInit(): void {
    this.loadOrders();

    if (this.route.snapshot.queryParamMap.get('create') === '1') {
      this.openAddOrder();
    }
  }

  loadOrders(): void {
    this.orderService.getAllForSupplier().subscribe({
      next: (res) => {
        const rawOrders = res || [];
        // Map backend data to frontend model to ensure consistent property access
        this.orders = rawOrders.map((o: any) => {
          const trackingValue = this.resolveTrackingValue(o);
          const normalizedTracking = this.normalizeTrackingValue(trackingValue || o?.trackingCode, o);
          return {
            ...o,
            trackingCode: normalizedTracking || trackingValue || o.trackingCode || '',
            trackingDisplay: normalizedTracking || trackingValue || this.getTrackingFallbackLabel(o),
            hasTracking: !!(normalizedTracking || trackingValue),
            items: (o.items || o.orderItems || []).map((it: any) => ({
              ...it,
              qty: it.qty || it.quantity || 0,
              price: it.price || it.purchasePrice || it.priceAtPurchase || 0,
              productName: it.productName || it.name
            }))
          };
        });

        this.applyFilters();
        this.calculateSellerStats();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading seller orders:', err);
        this.showError('Failed to load orders');
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    const q = (this.searchTerm || '').trim().toLowerCase();

    this.filteredOrders = this.orders.filter(o => {
      const orderNo = (o.referenceCode || o.orderNo || o.orderNumber || '').toLowerCase();
      const customerName = (o.customerName || '').toLowerCase();
      const phone = (o.phone || o.recipientPhone || '').toLowerCase();
      const tracking = (o.trackingDisplay || o.trackingCode || '').toString().toLowerCase();

      const matchesSearch =
        !q ||
        orderNo.includes(q) ||
        customerName.includes(q) ||
        phone.includes(q) ||
        tracking.includes(q);

      const status = this.normalizeStatusValue(o.status);
      const matchesStatus = this.selectedStatus === 'all' || status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
    this.cdr.detectChanges();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'all';
    this.statusMenuOpen = false;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  toggleStatusDropdown(): void {
    this.statusMenuOpen = !this.statusMenuOpen;
  }

  selectStatus(status: string): void {
    this.selectedStatus = status;
    this.statusMenuOpen = false;
    this.applyFilters();
  }

  getSelectedStatusLabel(): string {
    const option = this.statusOptions.find((item) => item.value === this.selectedStatus);
    return option?.label || 'All Orders';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.status-select-wrap')) {
      this.statusMenuOpen = false;
    }
  }

  openView(order: any): void {
    this.selectedOrder = order;
    this.viewModalVisible = true;
    this.cdr.detectChanges();
  }

  closeView(): void {
    this.viewModalVisible = false;
    this.selectedOrder = null;
    this.cdr.detectChanges();
  }

  getStatusLabel(status: any): string {
    const s = (status || '').toString().toLowerCase();
    switch (s) {
      case 'purchased':
      case 'pending':
        return 'Pending Review';
      case 'verified':
        return 'Verified';
      case 'processing':
        return 'In Progress';
      case 'shipped':
        return 'On the Way';
      case 'settled':
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      case 'all':
        return 'All Orders';
      default:
        return status || 'Unknown';
    }
  }

  private normalizeStatusValue(status: any): string {
    const value = (status || '').toString().toLowerCase();
    if (value === 'purchased' || value === 'pending') return 'pending';
    if (value === 'verified') return 'verified';
    if (value === 'processing') return 'processing';
    if (value === 'shipped') return 'shipped';
    if (value === 'settled' || value === 'delivered') return 'delivered';
    if (value === 'cancelled') return 'cancelled';
    return 'all';
  }

  private getTrackingFallbackLabel(order: any): string {
    const status = (order?.status || '').toLowerCase();
    if (status === 'pending' || status === 'purchased' || status === 'processing') {
      return 'Pending assignment';
    }

    return 'N/A';
  }

  private resolveTrackingValue(source: any): string {
    if (!source || typeof source !== 'object') {
      return '';
    }

    const direct = [
      source?.trackingCode,
      source?.deliveryTrackingNumber,
      source?.primeShipTrackingNumber,
      source?.trackingNumber,
      source?.trackingNo,
      source?.trackingId,
      source?.primeShipInfo?.trackingNumber,
      source?.order?.trackingCode,
      source?.order?.deliveryTrackingNumber,
      source?.order?.primeShipTrackingNumber
    ].find((value: any) => (typeof value === 'string' || typeof value === 'number') && `${value}`.trim().length > 0);

    if (direct !== undefined) {
      return `${direct}`.trim();
    }

    return this.findTrackingDeep(source, 0) || '';
  }

  private normalizeTrackingValue(raw: any, order: any): string {
    const value = (raw ?? '').toString().trim();
    if (!value) {
      return '';
    }

    if (this.isNewTrackingFormat(value)) {
      return value;
    }

    const productName = this.getPrimaryProductName(order);
    const initials = this.extractTrackingInitials(productName);
    const digitsOnly = value.replace(/\D/g, '');
    if (!digitsOnly) {
      return value;
    }

    const tenDigits = digitsOnly.length >= 10
      ? digitsOnly.slice(-10)
      : digitsOnly.padStart(10, '0');

    return `UK-${initials}${tenDigits}`;
  }

  private isNewTrackingFormat(value: string): boolean {
    return /^UK-[A-Z]{2}\d{10}$/.test(value);
  }

  private extractTrackingInitials(name: string): string {
    const letters = (name || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    if (!letters) {
      return 'XX';
    }
    return `${letters[0]}${letters[letters.length - 1]}`;
  }

  private getPrimaryProductName(order: any): string {
    const items = order?.items || order?.orderItems || [];
    for (const item of items) {
      const name = (item?.productName || item?.name || '').toString().trim();
      if (name) {
        return name;
      }
    }
    return '';
  }

  private findTrackingDeep(node: any, depth: number): string {
    if (!node || depth > 4) {
      return '';
    }

    if (typeof node !== 'object') {
      return '';
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = this.findTrackingDeep(item, depth + 1);
        if (found) {
          return found;
        }
      }

      return '';
    }

    for (const [key, value] of Object.entries(node)) {
      if (key.toLowerCase().includes('tracking') && (typeof value === 'string' || typeof value === 'number')) {
        const normalized = `${value}`.trim();
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }

    for (const value of Object.values(node)) {
      const found = this.findTrackingDeep(value, depth + 1);
      if (found) {
        return found;
      }
    }

    return '';
  }

  getOrderTotal(order: any): number {
    if (!order) return 0;
    if (order.totalPurchaseAmount !== undefined) return order.totalPurchaseAmount;
    if (order.totalAmount !== undefined) return order.totalAmount;

    const items = order.items || order.orderItems || [];
    const base = items.reduce((sum: number, it: any) => {
      const qty = it.qty || it.quantity || 0;
      const price = it.purchasePrice || it.price || it.priceAtPurchase || 0;
      return sum + (qty * price);
    }, 0);
    const shipping = order.shippingCost || 0;
    const platform = order.platformCharges || 0;
    return base + shipping + platform;
  }

  formatPrice(amount: any): string {
    const val = parseFloat(amount || 0);
    return isNaN(val) ? '$0.00' : '$' + val.toFixed(2);
  }

  getOrderReference(order: any): string {
    return order?.referenceCode || order?.orderNo || order?.orderNumber || `ORD-${order?.id ?? 'N/A'}`;
  }

  getPrimaryItemName(order: any): string {
    const items = order?.items || order?.orderItems || [];
    const primary = items.find((item: any) => (item?.productName || item?.name || '').toString().trim().length > 0);
    return primary?.productName || primary?.name || 'Item unavailable';
  }

  getOrderItemsCount(order: any): number {
    const items = order?.items || order?.orderItems || [];
    return Array.isArray(items) ? items.length : 0;
  }

  getOrderStageNote(status: any): string {
    const normalized = (status || '').toLowerCase();
    switch (normalized) {
      case 'purchased':
      case 'pending':
        return 'Awaiting verification and dispatch assignment';
      case 'verified':
        return 'Order verified and queued for fulfillment';
      case 'processing':
        return 'Supplier team is preparing the shipment';
      case 'shipped':
        return 'Shipment is on the move to destination';
      case 'settled':
      case 'delivered':
        return 'Order completed and logged successfully';
      case 'cancelled':
        return 'Order was cancelled before completion';
      default:
        return 'Status update will appear here once available';
    }
  }

  searchProduct(): void {
    if (!this.skuSearchTerm) return;
    this.productService.getProductBySku(this.skuSearchTerm).subscribe({
      next: (res) => {
        this.foundProduct = res;
        this.toastService.showSuccess('Product found: ' + res.name);
      },
      error: (err) => {
        this.toastService.showError('Product not found with SKU: ' + this.skuSearchTerm);
        this.foundProduct = null;
      }
    });
  }

  addProductToOrder(): void {
    if (!this.foundProduct) return;

    // Add to cart for "integration with cart and checkout process"
    this.cartService.addToCart(this.foundProduct, 1);
    this.toastService.showSuccess('Added to cart: ' + this.foundProduct.name);

    const existing = this.newOrder.items.find(i => i.name === this.foundProduct.name);
    if (existing) {
      existing.qty++;
    } else {
      const newItem = {
        name: this.foundProduct.name,
        productId: this.foundProduct.id,
        qty: 1,
        price: this.foundProduct.resellerPrice || this.foundProduct.price
      };

      if (this.newOrder.items.length === 1 && !this.newOrder.items[0].name) {
        this.newOrder.items[0] = newItem;
      } else {
        this.newOrder.items.push(newItem);
      }
    }
    this.skuSearchTerm = '';
    this.foundProduct = null;
  }

  checkoutWithCart(): void {
    this.router.navigate(['/checkout']);
  }

  updateOrderStatus(order: any, newStatus: OrderStatus): void {
    // In a real app, this would call the API
    this.toastService.showInfo('Status update integration pending...');
    order.status = newStatus;
    this.calculateSellerStats();
  }

  openAddOrder(): void {
    this.addOrderModalVisible = true;
    this.newOrder = {
      customerName: '',
      phone: '',
      address: '',
      items: [{ name: '', productId: '', qty: 1, price: 0 }] as any[]
    };
  }

  closeAddOrder(): void {
    this.addOrderModalVisible = false;
    this.createConfirmVisible = false;
    this.newOrder = {
      customerName: '',
      phone: '',
      address: '',
      items: [{ name: '', productId: '', qty: 1, price: 0 }]
    };
  }

  showSuccess(message: string): void {
    this.successMessage = message;
    this.successPopupVisible = true;
    window.setTimeout(() => {
      this.successPopupVisible = false;
    }, 2500);
  }

  showError(message: string): void {
    this.errorMessage = message;
    this.errorPopupVisible = true;
    window.setTimeout(() => {
      this.errorPopupVisible = false;
    }, 3200);
  }

  closeSuccessPopup(): void {
    this.successPopupVisible = false;
  }

  closeErrorPopup(): void {
    this.errorPopupVisible = false;
  }

  addOrderItem(): void {
    this.newOrder.items.push({ name: '', productId: '', qty: 1, price: 0 });
  }

  removeOrderItem(index: number): void {
    if (this.newOrder.items.length > 1) {
      this.newOrder.items.splice(index, 1);
    }
  }

  openCreateConfirm(): void {
    if (!this.newOrder.customerName || !this.newOrder.phone || !this.newOrder.address) {
      this.showError('Please fill in all customer details');
      return;
    }

    const validItems = this.newOrder.items.filter(item => item.name && item.price > 0);
    if (validItems.length === 0) {
      this.showError('Please add at least one valid item');
      return;
    }

    this.createConfirmVisible = true;
  }

  closeCreateConfirm(): void {
    this.createConfirmVisible = false;
  }

  confirmCreate(): void {
    if (!this.createConfirmVisible) {
      return;
    }
    this.createConfirmVisible = false;
    this.saveOrderInternal();
  }

  private saveOrderInternal(): void {
    const input = {
      customerName: this.newOrder.customerName,
      shippingAddress: this.newOrder.address,
      warehouseAddress: this.newOrder.address, // Defaulting to same for now
      items: this.newOrder.items
        .filter(item => item.productId && item.qty > 0)
        .map(item => ({
          productId: item.productId,
          quantity: item.qty,
          purchasePrice: item.price
        }))
    };

    this.orderService.createSupplierOrder(input).subscribe({
      next: () => {
        this.showSuccess('Order request sent to admin');
        this.closeAddOrder();
        this.loadOrders();
      },
      error: (err) => {
        console.error('Failed to create wholesale order:', err);
        this.showError('Failed to place order. Please check details.');
      }
    });
  }

  getNewOrderTotal(): number {
    return this.newOrder.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  }

  calculateSellerStats(): void {
    this.sellerStats = {
      totalOrders: this.orders.length,
      totalEarnings: this.orders.reduce((sum, order) => sum + (order.totalPurchaseAmount || 0), 0),
      pendingOrders: this.orders.filter(o => {
        const s = (o.status || '').toLowerCase();
        return s === 'purchased' || s === 'pending';
      }).length,
      deliveredOrders: this.orders.filter(o => {
        const s = (o.status || '').toLowerCase();
        return s === 'settled' || s === 'delivered';
      }).length
    };
  }

  openDeleteConfirm(order: any): void {
    this.orderToDelete = order;
    this.deleteConfirmVisible = true;
  }

  closeDeleteConfirm(): void {
    this.deleteConfirmVisible = false;
    this.orderToDelete = null;
  }

  confirmDelete(): void {
    if (!this.orderToDelete) {
      return;
    }
    // Simulation
    this.showSuccess('Order deleted successfully');
    this.closeDeleteConfirm();
  }
}
