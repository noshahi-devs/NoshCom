import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WalletDto {
    id: string;
    userId: number;
    balance: number;
    currency: string;
}

export interface WalletTransactionDto {
    id: string;
    walletId: string;
    amount: number;
    transactionType?: 'Sale' | 'Payout' | 'Refund';
    movementType?: string;
    referenceId: string;
    description: string;
    status: string;
    creationTime: string;
    __showFull?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class WalletService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/api/services/app/SmartStoreWallet`;

    getMyWallet(): Observable<WalletDto> {
        return this.http.get<any>(`${this.baseUrl}/GetMyWallet`)
            .pipe(map(res => (res?.result ?? res) as WalletDto));
    }

    getTransactions(): Observable<WalletTransactionDto[]> {
        return this.http.get<any>(`${this.baseUrl}/GetTransactions`)
            .pipe(map(res => {
                const payload = res?.result ?? res;
                if (Array.isArray(payload?.items)) return payload.items as WalletTransactionDto[];
                if (Array.isArray(payload)) return payload as WalletTransactionDto[];
                return [] as WalletTransactionDto[];
            }));
    }
}
