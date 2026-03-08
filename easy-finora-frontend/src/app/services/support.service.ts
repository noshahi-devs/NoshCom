import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SupportService {
    private apiUrl = `${environment.apiUrl}/api/services/app/SupportTicket`;

    constructor(private http: HttpClient) { }

    private getHeaders() {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': '3',
            'Authorization': `Bearer ${token}`
        });
    }

    createTicket(input: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/Create`, input, { headers: this.getHeaders() });
    }

    getMyTickets(skipCount: number = 0, maxResultCount: number = 10): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetMyTickets`, {
            headers: this.getHeaders(),
            params: { skipCount, maxResultCount }
        });
    }

    getAllTickets(skipCount: number = 0, maxResultCount: number = 50): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetAllTickets`, {
            headers: this.getHeaders(),
            params: { skipCount, maxResultCount }
        });
    }

    updateStatus(id: string, status: string, adminRemarks: string): Observable<any> {
        return this.http.put(`${this.apiUrl}/UpdateStatus`, { id, status, adminRemarks }, {
            headers: this.getHeaders()
        });
    }
}
