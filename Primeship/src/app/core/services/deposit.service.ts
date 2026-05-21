import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class DepositService {
    private apiUrl = `${environment.apiUrl}/services/app/DepositRequest`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    submitDepositRequest(input: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/Create`, input, {
            headers: this.authService.getAuthHeaders()
        }).pipe(
            tap(response => console.log('DepositService.submitDepositRequest response:', response))
        );
    }

    getMyDepositRequests(skipCount: number = 0, maxResultCount: number = 10): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetMyRequests`, {
            headers: this.authService.getAuthHeaders(),
            params: { skipCount, maxResultCount }
        });
    }

    getAllDepositRequests(skipCount: number = 0, maxResultCount: number = 50): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetAllRequests`, {
            headers: this.authService.getAuthHeaders(),
            params: { skipCount, maxResultCount, _t: new Date().getTime() }
        });
    }

    approveDeposit(id: string, adminRemarks: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/Approve`, this.buildActionPayload(id, adminRemarks), {
            headers: this.authService.getAuthHeaders()
        });
    }

    rejectDeposit(id: string, adminRemarks: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/Reject`, this.buildActionPayload(id, adminRemarks), {
            headers: this.authService.getAuthHeaders()
        });
    }

    private buildActionPayload(id: string, adminRemarks: string) {
        const normalizedId = (id ?? '').toString().trim();
        const remarks = (adminRemarks ?? '').trim() || 'Approved';
        return {
            id: normalizedId,
            adminRemarks: remarks
        };
    }

    getProofImage(id: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetProofImage`, {
            headers: this.authService.getAuthHeaders(),
            params: { id }
        });
    }
}
