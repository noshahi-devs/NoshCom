import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class DepositService {
    private apiUrl = `${environment.apiUrl}/api/services/app/DepositRequest`;

    constructor(private http: HttpClient) { }

    private getHeaders() {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': '3',
            'Authorization': `Bearer ${token}`
        });
    }

    submitDepositRequest(input: any): Observable<any> {
        console.log('DepositService.submitDepositRequest payload is:', input);

        return this.http.post(`${this.apiUrl}/Create`, input, { headers: this.getHeaders() }).pipe(
            tap(response => console.log('DepositService.submitDepositRequest response is:', response))
        );
    }

    getMyDepositRequests(skipCount: number = 0, maxResultCount: number = 10): Observable<any> {
        console.log('DepositService.getMyDepositRequests called');

        return this.http.get(`${this.apiUrl}/GetMyRequests`, {
            headers: this.getHeaders(),
            params: { skipCount, maxResultCount }
        }).pipe(
            tap(response => console.log('DepositService.getMyDepositRequests response is:', response))
        );
    }

    getAllDepositRequests(skipCount: number = 0, maxResultCount: number = 50): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetAllRequests`, {
            headers: this.getHeaders(),
            params: { skipCount, maxResultCount, _t: new Date().getTime() }
        });
    }

    approveDeposit(id: string, adminRemarks: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/Approve`, { id, adminRemarks }, {
            headers: this.getHeaders()
        });
    }

    rejectDeposit(id: string, adminRemarks: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/Reject`, { id, adminRemarks }, {
            headers: this.getHeaders()
        });
    }

    getProofImage(id: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetProofImage`, {
            headers: this.getHeaders(),
            params: { id }
        });
    }
}
