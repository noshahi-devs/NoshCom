import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConsts } from '@shared/AppConsts';

export interface DepositRequestDto {
    id: string;
    userId: number;
    userName: string;
    amount: number;
    currency: string;
    country: string;
    destinationAccount: string;
    proofImage: string;
    status: string;
    adminRemarks: string;
    creationTime: string;
}

@Injectable({
    providedIn: 'root'
})
export class DepositRequestService {
    private baseUrl = AppConsts.remoteServiceBaseUrl + '/api/services/app/DepositRequest';

    constructor(private http: HttpClient) { }

    getAllRequests(skipCount: number, maxResultCount: number): Observable<any> {
        return this.http.get(`${this.baseUrl}/GetAllRequests`, {
            params: {
                SkipCount: skipCount.toString(),
                MaxResultCount: maxResultCount.toString()
            }
        });
    }

    approve(id: string, adminRemarks: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/Approve`, { id, adminRemarks });
    }

    reject(id: string, adminRemarks: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/Reject`, { id, adminRemarks });
    }
}
