import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, timeout, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminStatsDto {
    totalRevenue: number;
    totalOrders: number;
    totalSellers: number;
    activeStores: number;
    pendingApprovals: number;
    activeProducts: number;
    totalCustomers: number;
}

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/api/services/app/AdminDashboard`;

    getStats(): Observable<AdminStatsDto> {
        return this.http.get<any>(`${this.baseUrl}/GetStats`).pipe(
            timeout(30_000),
            map(res => res.result),
            catchError(err => {
                if (err?.name === 'TimeoutError') {
                    return throwError(() => ({ ...err, status: 408, message: 'Dashboard stats request timed out.' }));
                }
                return throwError(() => err);
            })
        );
    }
}
