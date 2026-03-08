import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: number;
  orderNo: string;
  customerName: string;
  phone: string;
  address: string;
  status: OrderStatus;
  createdAt: Date;
  items: OrderItem[];
  sellerId?: number;
  sellerName?: string;
  sellerEarnings?: number;
}

export interface StatusChangeLog {
  orderId: number;
  orderNo: string;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
  changedBy: 'admin' | 'seller';
  timestamp: Date;
  sellerId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private orders: Order[] = [];
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  private statusChangeLogs: StatusChangeLog[] = [];

  constructor() {
    this.loadInitialData();
  }

  // Observable for orders
  getOrders(): Observable<Order[]> {
    return this.ordersSubject.asObservable();
  }

  // Get current orders array
  getCurrentOrders(): Order[] {
    return [...this.orders];
  }

  // Update order status (used by admin)
  updateOrderStatus(orderId: number, newStatus: OrderStatus | string, changedBy: 'admin' | 'seller' = 'admin'): void {
    const orderIndex = this.orders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      const oldStatus = this.orders[orderIndex].status;
      // Convert string to OrderStatus if needed
      const statusToSet = typeof newStatus === 'string' ? newStatus as OrderStatus : newStatus;
      this.orders[orderIndex].status = statusToSet;
      
      // Update seller earnings if delivered
      if (statusToSet === 'delivered') {
        this.orders[orderIndex].sellerEarnings = this.getOrderTotal(this.orders[orderIndex]);
      } else if (statusToSet === 'cancelled') {
        this.orders[orderIndex].sellerEarnings = 0;
      }
      
      // Log the status change
      this.logStatusChange({
        orderId: this.orders[orderIndex].id,
        orderNo: this.orders[orderIndex].orderNo,
        oldStatus,
        newStatus: statusToSet,
        changedBy,
        timestamp: new Date(),
        sellerId: this.orders[orderIndex].sellerId
      });
      
      // Notify all subscribers
      this.ordersSubject.next([...this.orders]);
    }
  }

  // Get orders for specific seller
  getSellerOrders(sellerId: number): Order[] {
    return this.orders.filter(order => order.sellerId === sellerId);
  }

  // Add new order (used by seller)
  addOrder(order: Omit<Order, 'id' | 'orderNo' | 'createdAt'>): Order {
    const newOrder: Order = {
      ...order,
      id: Math.max(...this.orders.map(o => o.id), 0) + 1,
      orderNo: 'ORD-' + (1000 + this.orders.length + 1),
      createdAt: new Date(),
      sellerEarnings: 0
    };
    
    this.orders.unshift(newOrder);
    this.ordersSubject.next([...this.orders]);
    
    return newOrder;
  }

  // Delete order (used by admin)
  deleteOrder(orderId: number): void {
    this.orders = this.orders.filter(o => o.id !== orderId);
    this.ordersSubject.next([...this.orders]);
  }

  // Get status change logs
  getStatusChangeLogs(): StatusChangeLog[] {
    return [...this.statusChangeLogs];
  }

  // Get status change logs for specific seller
  getSellerStatusLogs(sellerId: number): StatusChangeLog[] {
    return this.statusChangeLogs.filter(log => log.sellerId === sellerId);
  }

  // Calculate order total
  private getOrderTotal(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
  }

  // Log status changes
  private logStatusChange(log: StatusChangeLog): void {
    this.statusChangeLogs.push(log);
    console.log(`Status Change Logged: ${log.orderNo} - ${log.oldStatus} → ${log.newStatus} by ${log.changedBy}`);
  }

  // Load initial data
  private loadInitialData(): void {
    this.orders = [
      {
        id: 1,
        orderNo: 'ORD-1001',
        customerName: 'Ali Khan',
        phone: '0300-1111111',
        address: 'Lahore, Punjab',
        status: 'pending',
        createdAt: new Date('2026-01-10'),
        items: [
          { name: 'iPhone 15 Pro', qty: 1, price: 899 },
          { name: 'AirPods Pro', qty: 1, price: 199 }
        ],
        sellerId: 1,
        sellerName: 'Tech Store',
        sellerEarnings: 0
      },
      {
        id: 2,
        orderNo: 'ORD-1002',
        customerName: 'Fatima Noor',
        phone: '0301-2222222',
        address: 'Karachi, Sindh',
        status: 'processing',
        createdAt: new Date('2026-01-12'),
        items: [{ name: 'Sony WH-1000XM5', qty: 1, price: 349 }],
        sellerId: 1,
        sellerName: 'Tech Store',
        sellerEarnings: 0
      },
      {
        id: 3,
        orderNo: 'ORD-1003',
        customerName: 'Usman Ahmad',
        phone: '0302-3333333',
        address: 'Islamabad, ICT',
        status: 'shipped',
        createdAt: new Date('2026-01-14'),
        items: [{ name: 'MacBook Pro 16"', qty: 1, price: 2299 }],
        sellerId: 2,
        sellerName: 'Gadget World',
        sellerEarnings: 0
      },
      {
        id: 4,
        orderNo: 'ORD-1004',
        customerName: 'Ayesha Malik',
        phone: '0303-4444444',
        address: 'Faisalabad, Punjab',
        status: 'delivered',
        createdAt: new Date('2026-01-05'),
        items: [
          { name: 'Nike Air Max 270', qty: 2, price: 120 },
          { name: 'T-Shirt', qty: 3, price: 15 }
        ],
        sellerId: 1,
        sellerName: 'Tech Store',
        sellerEarnings: 285
      },
      {
        id: 5,
        orderNo: 'ORD-1005',
        customerName: 'Hamza Sheikh',
        phone: '0304-5555555',
        address: 'Multan, Punjab',
        status: 'cancelled',
        createdAt: new Date('2026-01-08'),
        items: [{ name: 'Samsung 4K Smart TV', qty: 1, price: 699 }],
        sellerId: 2,
        sellerName: 'Gadget World',
        sellerEarnings: 0
      }
    ];
    
    this.ordersSubject.next([...this.orders]);
  }
}
