import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

type AdminDashboardStatsResult = {
    result?: {
        totalUsers?: number;
        pendingDeposits?: number;
        pendingWithdrawals?: number;
        openTickets?: number;
        totalTransactionVolume?: number;
    };
};

@Injectable({
    providedIn: 'root'
})
export class AdminDashboardService {
    private apiUrl = `${environment.apiUrl}/api/services/app/GlobalPayAdminDashboard`;

    constructor(private http: HttpClient) { }

    private getHeaders() {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': '3',
            'Authorization': `Bearer ${token}`
        });
    }

    getStats(): Observable<AdminDashboardStatsResult> {
        return this.http.get<AdminDashboardStatsResult>(`${this.apiUrl}/GetStats`, {
            headers: this.getHeaders()
        });
    }
}
