import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class WalletService {
    private apiUrl = `${environment.apiUrl}/services/app/Wallet`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    getMyWallet(): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetMyWallet`, {
            headers: this.authService.getAuthHeaders()
        });
    }

    transfer(input: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/Transfer`, input, {
            headers: this.authService.getAuthHeaders()
        });
    }

    verifyWalletId(walletId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/VerifyWalletId`, { walletId }, {
            headers: this.authService.getAuthHeaders()
        });
    }
}
