import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class WithdrawService {
    private apiUrl = `${environment.apiUrl}/services/app/Withdraw`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    submitWithdrawRequest(input: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/SubmitWithdrawRequest`, input, {
            headers: this.authService.getAuthHeaders()
        });
    }

    getMyWithdrawRequests(skipCount: number = 0, maxResultCount: number = 10): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetMyWithdrawRequests`, {
            headers: this.authService.getAuthHeaders(),
            params: { skipCount, maxResultCount }
        });
    }

    getAllWithdrawRequests(skipCount: number = 0, maxResultCount: number = 50): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetAllWithdrawRequests`, {
            headers: this.authService.getAuthHeaders(),
            params: { skipCount, maxResultCount, _t: new Date().getTime() }
        });
    }

    getWithdrawalEligibility(): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetWithdrawalEligibility`, {
            headers: this.authService.getAuthHeaders()
        });
    }

    approveWithdraw(id: number, adminRemarks: string, paymentProof: string = ''): Observable<any> {
        return this.http.post(`${this.apiUrl}/ApproveWithdraw`, { id, adminRemarks, paymentProof }, {
            headers: this.authService.getAuthHeaders()
        });
    }

    rejectWithdraw(id: number, adminRemarks: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/RejectWithdraw`, { id, adminRemarks }, {
            headers: this.authService.getAuthHeaders()
        });
    }

    getPaymentProof(id: number): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetPaymentProof`, {
            headers: this.authService.getAuthHeaders(),
            params: { id }
        });
    }
}
