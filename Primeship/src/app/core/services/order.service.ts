import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
    name: string;
    qty: number;
    price: number;
}

export interface Order {
    id: any;
    referenceCode: string;
    orderNo?: string;
    customerName: string;
    phone?: string;
    address?: string;
    shippingAddress?: string;
    status: OrderStatus;
    creationTime: Date;
    createdAt?: Date; // compatibility
    items: OrderItem[];
    resellerId?: number;
    supplierId?: number;
    sellerId?: number;
    sellerName?: string;
    sellerEarnings?: number;
}

export interface CreateOrderInput {
    paymentMethod: string;
    shippingAddress: string;
    country: string;
    state: string;
    city: string;
    postalCode: string;
    shippingCost: number;
    discount: number;
    customerProfileId: string;
    sourcePlatform: string;
}

export interface CreateOrderItemInput {
    productId?: string;
    storeProductId?: string;
    quantity: number;
    price?: number;
    productName?: string;
    imageUrl?: string;
}

export interface CreateOrderDto {
    userId?: number;
    paymentMethod?: string;
    shippingAddress?: string;
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    shippingCost?: number;
    discount?: number;
    sourcePlatform?: string;
    cardNumber?: string;
    cvv?: string;
    expiryDate?: string;
    items?: CreateOrderItemInput[];
}

@Injectable({
    providedIn: 'root'
})
export class OrderService {
    // environment.apiUrl already points to the API root (includes /api for proxy/dev).
    private apiRoot = environment.apiUrl.replace(/\/$/, '');
    private apiUrl = `${this.apiRoot}/services/app/Order`;
    private wholesaleApiUrl = `${this.apiRoot}/services/app/SupplierOrder`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    createOrder(input: CreateOrderInput): Observable<any> {
        return this.http.post(`${this.apiUrl}/Create`, input, {
            headers: this.authService.getAuthHeaders()
        });
    }

    createOrderWithItems(input: CreateOrderDto): Observable<any> {
        return this.http.post(`${this.apiUrl}/Create`, input, {
            headers: this.authService.getAuthHeaders()
        }).pipe(
            map((response: any) => response?.result ?? response)
        );
    }

    createSupplierOrder(input: any): Observable<any> {
        return this.http.post(`${this.wholesaleApiUrl}/Create`, input, {
            headers: this.authService.getAuthHeaders()
        });
    }

    getOrders(): Observable<Order[]> {
        return this.http.get<any>(`${this.apiUrl}/GetAllForCustomer`, {
            headers: this.authService.getAuthHeaders()
        }).pipe(
            map(response => response.result || [])
        );
    }

    getAllOrders(): Observable<Order[]> {
        return this.http.get<any>(`${this.wholesaleApiUrl}/GetAll`, {
            headers: this.authService.getAuthHeaders()
        }).pipe(
            map(response => {
                const res = response?.result ?? response;
                return res?.items ?? res ?? [];
            })
        );
    }

    getAllForSupplier(): Observable<any[]> {
        return this.http.get<any>(`${this.wholesaleApiUrl}/GetMyOrders`, {
            headers: this.authService.getAuthHeaders()
        }).pipe(
            map(response => response.result?.items || [])
        );
    }

    deleteOrder(id: any): Observable<any> {
        return this.http.delete(`${this.apiUrl}/Delete`, {
            params: { id },
            headers: this.authService.getAuthHeaders()
        });
    }

    markAsVerified(id: string): Observable<any> {
        return this.http.post(`${this.wholesaleApiUrl}/MarkAsVerified`, { id }, {
            headers: this.authService.getAuthHeaders()
        });
    }

    markAsDelivered(id: string): Observable<any> {
        return this.http.post(`${this.wholesaleApiUrl}/MarkAsDelivered`, { id }, {
            headers: this.authService.getAuthHeaders()
        });
    }

    updateOrderStatus(id: any, status: OrderStatus): Observable<any> {
        return this.http.put(`${this.wholesaleApiUrl}/UpdateStatus`, { id, status }, {
            headers: this.authService.getAuthHeaders()
        });
    }
}
