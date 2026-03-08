import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminStatsDto {
    totalRevenue: number;
    totalOrders: number;
    activeStores: number;
    pendingApprovals: number;
    totalCustomers: number;
}

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/api/services/app/AdminDashboard`;

    getStats(): Observable<AdminStatsDto> {
        return this.http.get<any>(`${this.baseUrl}/GetStats`)
            .pipe(map(res => res.result));
    }
}
