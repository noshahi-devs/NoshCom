import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class WalletService {
    private apiUrl = `${environment.apiUrl}/api/services/app/Wallet`;

    constructor(private http: HttpClient) { }

    private getHeaders() {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': '3',
            'Authorization': `Bearer ${token}`
        });
    }

    getMyWallet(): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetMyWallet`, { headers: this.getHeaders() });
    }

    transfer(input: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/Transfer`, input, { headers: this.getHeaders() });
    }

    verifyWalletId(walletId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/VerifyWalletId`, { walletId }, { headers: this.getHeaders() });
    }
}
