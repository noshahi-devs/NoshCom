import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SupplierOrderService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/api/services/app/SupplierOrder`;

    getMyOrders(): Observable<any[]> {
        return this.http.get<any>(`${this.baseUrl}/GetMyOrders`).pipe(
            map(res => res.result?.items || [])
        );
    }

    getSupplierOrder(id: string): Observable<any> {
        return this.http.get<any>(`${this.baseUrl}/Get`, {
            params: { id }
        }).pipe(
            map(res => res.result)
        );
    }

    markAsShipped(input: { id: string, shipmentDate: string, carrierId: string, trackingCode: string }): Observable<any> {
        return this.http.post(`${this.baseUrl}/MarkAsShipped`, input);
    }

    markAsVerified(id: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/MarkAsVerified`, { id });
    }

    markAsDelivered(id: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/MarkAsDelivered`, { id });
    }

    getAllOrders(): Observable<any[]> {
        return this.http.get<any>(`${this.baseUrl}/GetAll`).pipe(
            map(res => res.result?.items || [])
        );
    }

    updateStatus(id: string, status: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/UpdateStatus`, { id, status });
    }
}
