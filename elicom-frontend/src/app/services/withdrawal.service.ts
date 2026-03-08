import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WithdrawRequestDto {
    id: string;
    userId?: number;
    userName?: string;
    amount: number;
    method?: string;
    paymentDetails?: string;
    status: string;
    creationTime: string;
    adminRemarks?: string;
}

@Injectable({
    providedIn: 'root'
})
export class WithdrawalService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/api/services/app/SmartStoreWithdraw`;
    private myRequestsCache: WithdrawRequestDto[] | null = null;
    private myRequestsCacheAt = 0;
    private readonly myRequestsCacheMs = 15000;

    submitWithdrawRequest(input: { amount: number; method: string; paymentDetails: string; localAmount?: number; localCurrency?: string }): Observable<any> {
        this.invalidateMyRequestsCache();
        return this.http.post(`${this.baseUrl}/SubmitWithdrawRequest`, input);
    }

    getMyWithdrawRequests(skipCount: number = 0, maxResultCount: number = 50): Observable<WithdrawRequestDto[]> {
        if (skipCount === 0 && this.isMyRequestsCacheFresh()) {
            return of(this.myRequestsCache || []);
        }

        return this.http.get<any>(`${this.baseUrl}/GetMyWithdrawRequests`, {
            params: {
                skipCount: skipCount.toString(),
                maxResultCount: maxResultCount.toString()
            }
        })
            .pipe(map(res => {
                const payload = res?.result ?? res;
                if (Array.isArray(payload?.items)) return payload.items as WithdrawRequestDto[];
                if (Array.isArray(payload?.items?.$values)) return payload.items.$values as WithdrawRequestDto[];
                if (Array.isArray(payload?.$values)) return payload.$values as WithdrawRequestDto[];
                if (Array.isArray(payload?.result?.items)) return payload.result.items as WithdrawRequestDto[];
                if (Array.isArray(payload?.result?.items?.$values)) return payload.result.items.$values as WithdrawRequestDto[];
                if (Array.isArray(payload)) return payload as WithdrawRequestDto[];
                return [] as WithdrawRequestDto[];
            }),
            tap(items => {
                if (skipCount === 0) {
                    this.myRequestsCache = items || [];
                    this.myRequestsCacheAt = Date.now();
                }
            }));
    }

    getAllWithdrawRequests(skipCount: number = 0, maxResultCount: number = 50): Observable<WithdrawRequestDto[]> {
        return this.http.get<any>(`${this.baseUrl}/GetAllWithdrawRequests`, {
            params: {
                skipCount: skipCount.toString(),
                maxResultCount: maxResultCount.toString()
            }
        })
            .pipe(map(res => {
                const payload = res?.result ?? res;
                if (Array.isArray(payload?.items)) return payload.items as WithdrawRequestDto[];
                if (Array.isArray(payload)) return payload as WithdrawRequestDto[];
                return [] as WithdrawRequestDto[];
            }));
    }

    approveWithdraw(id: number, adminRemarks: string = '', paymentProof: string = ''): Observable<any> {
        this.invalidateMyRequestsCache();
        return this.http.post(`${this.baseUrl}/ApproveWithdraw`, { id, adminRemarks, paymentProof });
    }

    rejectWithdraw(id: number, adminRemarks: string = ''): Observable<any> {
        this.invalidateMyRequestsCache();
        return this.http.post(`${this.baseUrl}/RejectWithdraw`, { id, adminRemarks });
    }

    private isMyRequestsCacheFresh(): boolean {
        if (!this.myRequestsCache) return false;
        return Date.now() - this.myRequestsCacheAt < this.myRequestsCacheMs;
    }

    private invalidateMyRequestsCache(): void {
        this.myRequestsCache = null;
        this.myRequestsCacheAt = 0;
    }
}
