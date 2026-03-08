import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreateOrderDto {
    userId: number;
    paymentMethod: string;
    shippingAddress: string;
    country: string;
    state: string;
    city: string;
    postalCode: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    shippingCost: number;
    discount: number;
    sourcePlatform?: string;
    cardNumber?: string;
    cvv?: string;
    expiryDate?: string;
    items?: any[];
}

@Injectable({
    providedIn: 'root'
})
export class OrderService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/api/services/app/Order`;

    createOrder(input: CreateOrderDto): Observable<any> {
        return this.http.post(`${this.baseUrl}/Create`, input);
    }

    getCustomerOrders(userId: number): Observable<any[]> {
        return this.http.get<any>(`${this.baseUrl}/GetAllForCustomer`, {
            params: { userId: userId.toString() }
        }).pipe(
            map(res => res.result || [])
        );
    }

    getCustomerOrdersPaged(input: { status?: string; skipCount: number; maxResultCount: number }): Observable<{ items: any[]; totalCount: number }> {
        const params: any = {
            skipCount: input.skipCount.toString(),
            maxResultCount: input.maxResultCount.toString()
        };
        if (input.status) {
            params.status = input.status;
        }
        return this.http.get<any>(`${this.baseUrl}/GetForCustomer`, { params }).pipe(
            map(res => res.result || { items: [], totalCount: 0 })
        );
    }

    getOrder(id: string): Observable<any> {
        return this.http.get<any>(`${this.baseUrl}/Get`, {
            params: { id }
        }).pipe(
            map(res => res.result)
        );
    }

    getOrdersByStore(storeId: string): Observable<any[]> {
        return this.http.get<any>(`${this.baseUrl}/GetByStore`, {
            params: { storeId }
        }).pipe(
            map(res => res.result || [])
        );
    }

    getAllOrders(): Observable<any[]> {
        return this.http.get<any>(`${this.baseUrl}/GetAll`).pipe(
            map(res => res.result || [])
        );
    }

    updateOrderStatus(id: string, status: string, trackingNumber?: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/UpdateStatus`, { id, status, deliveryTrackingNumber: trackingNumber });
    }

    fulfillOrder(input: { id: string, shipmentDate: string, carrierId: string, trackingCode: string }): Observable<any> {
        return this.http.post(`${this.baseUrl}/Fulfill`, input);
    }

    verifyOrder(id: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/Verify`, { id });
    }

    deliverOrder(id: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/Deliver`, { id });
    }

    cancelOrder(id: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/Cancel`, { id });
    }

    rejectOrder(id: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/Reject`, { id }).pipe(
            catchError((err: any) => {
                // Backward compatibility: if Reject endpoint is not deployed yet,
                // attempt legacy status update endpoint.
                if (err?.status === 404 || err?.status === 405) {
                    return this.http.post(`${this.baseUrl}/UpdateStatus`, { id, status: 'Rejected' });
                }
                return throwError(() => err);
            })
        );
    }

    getCarriers(): Observable<any[]> {
        return this.http.get<any>(`${this.baseUrl}/GetCarriers`).pipe(
            map(res => res.result || [])
        );
    }
}
