import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class TransactionService {
    private apiUrl = `${environment.apiUrl}/api/services/app/Transaction`;

    constructor(private http: HttpClient) { }

    private getHeaders() {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': '3',
            'Authorization': `Bearer ${token}`
        });
    }

    getHistory(skipCount: number = 0, maxResultCount: number = 10): Observable<any> {
        console.log('TransactionService.getHistory called');

        return this.http.get(`${this.apiUrl}/GetHistory`, {
            headers: this.getHeaders(),
            params: { skipCount, maxResultCount }
        }).pipe(
            tap(response => console.log('TransactionService.getHistory response is:', response))
        );
    }

    getAllTransactions(skipCount: number = 0, maxResultCount: number = 50): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetAll`, {
            headers: this.getHeaders(),
            params: { skipCount, maxResultCount }
        });
    }
}
