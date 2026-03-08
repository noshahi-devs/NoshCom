import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { OrderService, Order, OrderStatus } from '../../../core/services/order.service';

import { trigger, state, style, transition, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PrimeIcons } from 'primeng/api';
import { GameLoaderComponent } from '../../../shared/components/game-loader/game-loader.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, GameLoaderComponent],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
  animations: [
    trigger('slideInOut', [
      state('in', style({
        transform: 'translateY(0)',
        opacity: 1
      })),
      state('out', style({
        transform: 'translateY(-100%)',
        opacity: 0
      })),
      transition('out => in', [
        animate('0.3s ease-out')
      ]),
      transition('in => out', [
        animate('0.3s ease-in')
      ])
    ])
  ]
})
export class OrdersComponent implements OnInit {
  orders: any[] = [];
  filteredOrders: any[] = [];
  isLoading = false;

  searchTerm = '';
  selectedStatus: string = 'all';
  selectedSeller: any = 'all'; // Admin can filter by seller

  viewModalVisible = false;
  selectedOrder: any = null;

  // Status update modal properties
  statusUpdateModalVisible = false;
  orderForStatusUpdate: any = null;
  selectedNewStatus: string = 'pending';

  // Available statuses as const array
  availableStatuses: string[] = ['purchased', 'verified', 'processing', 'shipped', 'delivered', 'cancelled'];

  // Success popup properties
  showSuccessPopup = false;
  updatedOrderNumber = '';
  updatedStatusText = '';
  private successTimeout: any;

  // Delete success popup properties
  showDeleteSuccessPopup = false;
  deletedOrderNumber = '';
  private deleteSuccessTimeout: any;

  // Delete modal properties
  deleteModalVisible = false;
  orderToDelete: any = null;

  // Admin-specific properties
  adminStats = {
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    deliveredOrders: 0
  };

  constructor(
    private orderService: OrderService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadOrders();
  }

  private parseOrderDate(order: any): number {
    const created = order?.creationTime || order?.createdAt;
    const date = created ? new Date(created).getTime() : 0;
    if (date) { return date; }
    const orderNo = (order?.orderNo || order?.referenceCode || '').match(/(\d{8,})/);
    return orderNo ? parseInt(orderNo[1], 10) : 0;
  }

  private sortOrdersDesc(list: any[]): any[] {
    return [...list].sort((a, b) => this.parseOrderDate(b) - this.parseOrderDate(a));
  }

  loadOrders(): void {
    this.isLoading = true;
    this.orderService.getAllOrders().subscribe({
      next: (orders) => {
        const rawOrders = orders || [];
        this.orders = this.sortOrdersDesc(rawOrders.map((o: any) => ({
          ...o,
          items: (o.items || o.orderItems || []).map((it: any) => ({
            ...it,
            qty: it.qty || it.quantity || 0,
            price: it.price || it.purchasePrice || it.priceAtPurchase || 0,
            name: it.productName || it.name // Admin template uses 'name'
          }))
        })));

        this.applyFilters();
        this.calculateAdminStats();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.orders = [];
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Admin can delete orders
  deleteOrder(order: Order): void {
    this.orderToDelete = order;
    this.deleteModalVisible = true;
    this.cdr.detectChanges();
  }

  closeDeleteModal(): void {
    this.deleteModalVisible = false;
    this.orderToDelete = null;
    this.cdr.detectChanges();
  }

  confirmDelete(): void {
    if (this.orderToDelete) {
      const orderNumber = this.orderToDelete.orderNo || this.orderToDelete.referenceCode || this.orderToDelete.orderNumber;
      this.orderService.deleteOrder(this.orderToDelete.id).subscribe({
        next: () => {
          this.showDeleteSuccessPopup = true;
          this.deletedOrderNumber = orderNumber;
          this.cdr.detectChanges();
          this.deleteSuccessTimeout = setTimeout(() => {
            this.hideDeleteSuccessPopup();
          }, 3000);
          this.loadOrders();
        },
        error: (err) => console.error('Delete failed', err)
      });
      this.closeDeleteModal();
    }
  }

  hideDeleteSuccessPopup(): void {
    this.showDeleteSuccessPopup = false;
    this.cdr.detectChanges();
    if (this.deleteSuccessTimeout) {
      clearTimeout(this.deleteSuccessTimeout);
    }
  }

  // Admin can assign orders to sellers
  assignOrderToSeller(order: any, sellerId: number, sellerName: string): void {
    order.sellerId = sellerId;
    order.sellerName = sellerName;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  // Status update methods
  openStatusUpdate(order: any): void {
    this.orderForStatusUpdate = order;
    this.selectedNewStatus = this.getNextStatus(order.status) || order.status;
    this.statusUpdateModalVisible = true;
    this.cdr.detectChanges();
  }

  closeStatusUpdate(): void {
    this.statusUpdateModalVisible = false;
    this.orderForStatusUpdate = null;
    this.selectedNewStatus = 'pending';
    this.cdr.detectChanges();
  }

  getNextStatus(currentStatus: string): string | null {
    const status = (currentStatus || '').toLowerCase();
    switch (status) {
      case 'purchased': return 'verified';
      case 'pending': return 'verified';
      case 'verified': return 'processing';
      case 'processing': return 'shipped';
      case 'shipped': return 'delivered';
      default: return null;
    }
  }

  updateOrderStatus(): void {
    const orderToUpdate = this.orderForStatusUpdate || this.selectedOrder;
    if (orderToUpdate && this.selectedNewStatus) {
      this.orderService.updateOrderStatus(orderToUpdate.id, this.selectedNewStatus as any).subscribe({
        next: () => {
          this.showSuccessPopup = true;
          this.updatedOrderNumber = this.orderForStatusUpdate!.orderNo || this.orderForStatusUpdate!.referenceCode || this.orderForStatusUpdate!.orderNumber;
          this.updatedStatusText = this.getStatusLabel(this.selectedNewStatus);
          this.cdr.detectChanges();
          setTimeout(() => this.hideSuccessPopup(), 3000);
          this.loadOrders(); // Refresh list
          this.closeStatusUpdate();
          // If update came from view modal, also close it or just refresh the selected order
          if (this.selectedOrder && this.selectedOrder.id === orderToUpdate.id) {
            this.selectedOrder.status = this.selectedNewStatus;
          }
        },
        error: (err) => {
          console.error('Error updating order status:', err);
          // Show error toast or similar if needed
        }
      });
    }
  }

  hideSuccessPopup(): void {
    this.showSuccessPopup = false;
    this.cdr.detectChanges();
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }
  }

  applyFilters(): void {
    const q = (this.searchTerm || '').trim().toLowerCase();

    this.filteredOrders = this.sortOrdersDesc(this.orders).filter(o => {
      const orderNo = (o.orderNo || o.referenceCode || o.orderNumber || '').toLowerCase();
      const customerName = (o.customerName || '').toLowerCase();
      const phone = (o.phone || '').toLowerCase();
      const sellerName = (o.sellerName || '').toLowerCase();

      const matchesSearch =
        !q ||
        orderNo.includes(q) ||
        customerName.includes(q) ||
        phone.includes(q) ||
        sellerName.includes(q);

      const status = (o.status || '').toLowerCase();
      const matchesStatus = this.selectedStatus === 'all' || status === this.selectedStatus.toLowerCase();
      const matchesSeller = this.selectedSeller === 'all' || o.sellerId === this.selectedSeller;

      return matchesSearch && matchesStatus && matchesSeller;
    });
    this.cdr.detectChanges();
  }

  calculateAdminStats(): void {
    this.adminStats = {
      totalOrders: this.orders.length,
      totalRevenue: this.orders.reduce((sum, order) => {
        const total = this.getOrderTotal(order);
        return sum + (isNaN(total) ? 0 : total);
      }, 0),
      pendingOrders: this.orders.filter(o => (o.status || '').toLowerCase() === 'pending').length,
      deliveredOrders: this.orders.filter(o => (o.status || '').toLowerCase() === 'delivered').length
    };
    this.cdr.detectChanges();
  }

  // Admin-specific methods
  getAllSellers(): { id: number; name: string }[] {
    const sellers = new Map<number, string>();
    this.orders.forEach(order => {
      if (order.sellerId && order.sellerName) {
        sellers.set(order.sellerId, order.sellerName);
      }
    });
    return Array.from(sellers.entries()).map(([id, name]) => ({ id, name }));
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'all';
    this.selectedSeller = 'all';
    this.applyFilters();
    this.cdr.detectChanges();
  }

  openView(order: any): void {
    this.selectedOrder = order;
    this.selectedNewStatus = order.status; // Initialize status for inline update
    this.viewModalVisible = true;
    this.cdr.detectChanges();
  }

  closeView(): void {
    this.viewModalVisible = false;
    this.selectedOrder = null;
    this.cdr.detectChanges();
  }

  getStatusLabel(status: any): string {
    const statusValue = (status || '').toLowerCase();
    switch (statusValue) {
      case 'purchased':
        return 'Purchased';
      case 'pending':
        return 'Pending';
      case 'verified':
        return 'Verified';
      case 'processing':
        return 'Processing';
      case 'shipped':
        return 'Shipped';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status || 'Unknown';
    }
  }

  getStatusDescription(status: any): string {
    const statusValue = (status || '').toLowerCase();
    switch (statusValue) {
      case 'purchased':
        return 'Initial wholesale order placed';
      case 'pending':
        return 'Order received, awaiting processing';
      case 'verified':
        return 'Order identity and items have been verified';
      case 'processing':
        return 'Order is being prepared for shipment';
      case 'shipped':
        return 'Order has been shipped and is in transit';
      case 'delivered':
        return 'Order has been successfully delivered';
      case 'cancelled':
        return 'Order has been cancelled';
      default:
        return 'Status: ' + (status || 'Unknown');
    }
  }

  getStatusStyle(status: any): any {
    const statusValue = (status || '').toLowerCase();
    switch (statusValue) {
      case 'purchased':
        return { backgroundColor: '#f3f4f6', color: '#374151' };
      case 'pending':
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'verified':
        return { backgroundColor: '#fff3e8', color: '#f85606' };
      case 'processing':
        return { backgroundColor: '#ffe8d6', color: '#e64a00' };
      case 'shipped':
        return { backgroundColor: '#e9d5ff', color: '#6b21a8' };
      case 'delivered':
        return { backgroundColor: '#d1fae5', color: '#065f46' };
      case 'cancelled':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  }

  getStatusIcon(status: any): string {
    const statusValue = (status || '').toLowerCase();
    switch (statusValue) {
      case 'purchased':
        return 'pi-shopping-cart';
      case 'pending':
        return 'pi-clock';
      case 'verified':
        return 'pi-verified';
      case 'processing':
        return 'pi-cog';
      case 'shipped':
        return 'pi-truck';
      case 'delivered':
        return 'pi-check-circle';
      case 'cancelled':
        return 'pi-times-circle';
      default:
        return 'pi-question-circle';
    }
  }

  getOrderTotal(order: any): number {
    if (!order) return 0;
    if (order.totalAmount !== undefined) return order.totalAmount;
    if (order.totalPurchaseAmount !== undefined) return order.totalPurchaseAmount;

    const items = order.items || order.orderItems || [];
    const base = items.reduce((sum: number, it: any) => {
      const qty = it.qty || it.quantity || 0;
      const price = it.price || it.purchasePrice || it.priceAtPurchase || 0;
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
}
