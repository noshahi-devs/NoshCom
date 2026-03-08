import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SellerPayoutMethodDto {
    methodKey: string;
    methodLabel: string;
    accountTitle: string;
    bankName: string;
    accountNumberMasked: string;
    routingNumber: string;
    swiftCode: string;
    walletId: string;
    cardHolderName: string;
    cardNumberMasked: string;
    expiryDate: string;
    isEasyFinoraVerified: boolean;
    verificationMessage: string;
    paymentDetails: string;
}

export interface SaveSellerPayoutMethodInput {
    methodKey: string;
    accountTitle?: string;
    bankName?: string;
    accountNumber?: string;
    routingNumber?: string;
    swiftCode?: string;
    walletId?: string;
    cardHolderName?: string;
    cardNumber?: string;
    expiryDate?: string;
}

@Injectable({ providedIn: 'root' })
export class SellerPayoutMethodService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/api/services/app/SmartStoreWithdraw`;
    private localKey = 'seller_payout_method_local_v1';
    private endpointStateKey = 'seller_payout_method_endpoint_state_v1';
    private disableMs = 5 * 60 * 1000; // 5 minutes

    getMyPayoutMethod(): Observable<SellerPayoutMethodDto> {
        return this.http.get<any>(`${this.baseUrl}/GetMyPayoutMethod`)
            .pipe(map(res => (res?.result ?? res) as SellerPayoutMethodDto));
    }

    saveMyPayoutMethod(input: SaveSellerPayoutMethodInput): Observable<SellerPayoutMethodDto> {
        return this.http.post<any>(`${this.baseUrl}/SaveMyPayoutMethod`, input)
            .pipe(map(res => (res?.result ?? res) as SellerPayoutMethodDto));
    }

    getMyPayoutMethodSafe(): Observable<SellerPayoutMethodDto | null> {
        if (this.isEndpointDisabled('get')) {
            return of(this.getMyPayoutMethodLocal());
        }

        return this.getMyPayoutMethod().pipe(
            timeout(4000),
            catchError((err) => {
                if (this.shouldFallbackToLocal(err)) {
                    this.disableEndpoint('get');
                    return of(this.getMyPayoutMethodLocal());
                }

                return throwError(() => err);
            })
        );
    }

    saveMyPayoutMethodSafe(input: SaveSellerPayoutMethodInput): Observable<SellerPayoutMethodDto> {
        if (this.isEndpointDisabled('save')) {
            return of(this.saveMyPayoutMethodLocal(input));
        }

        return this.saveMyPayoutMethod(input).pipe(
            timeout(7000),
            map(res => {
                // Always sync to local storage on success for future fallbacks
                this.saveMyPayoutMethodLocal(input);
                // If save succeeded, server is likely up - re-enable endpoints
                this.reEnableEndpoints();
                return res;
            }),
            catchError((err) => {
                if (this.shouldFallbackToLocal(err)) {
                    this.disableEndpoint('save');
                    return of(this.saveMyPayoutMethodLocal(input));
                }

                return throwError(() => err);
            })
        );
    }

    getMyPayoutMethodLocal(): SellerPayoutMethodDto | null {
        try {
            const raw = localStorage.getItem(this.localKey);
            if (!raw) return null;
            return JSON.parse(raw) as SellerPayoutMethodDto;
        } catch {
            return null;
        }
    }

    saveMyPayoutMethodLocal(input: SaveSellerPayoutMethodInput): SellerPayoutMethodDto {
        const methodKey = (input.methodKey || '').toLowerCase();
        const methodLabel = methodKey === 'easyfinora'
            ? 'Easy Finora Card'
            : methodKey === 'bank'
                ? 'Bank Transfer'
                : methodKey === 'wise'
                    ? 'Wise'
                    : methodKey === 'paypal'
                        ? 'PayPal'
                        : methodKey === 'stripe'
                            ? 'Stripe'
                            : methodKey;

        const dto: SellerPayoutMethodDto = {
            methodKey,
            methodLabel,
            accountTitle: input.accountTitle || '',
            bankName: input.bankName || '',
            accountNumberMasked: input.accountNumber ? this.maskTail(input.accountNumber) : '',
            routingNumber: input.routingNumber || '',
            swiftCode: input.swiftCode || '',
            walletId: input.walletId || '',
            cardHolderName: input.cardHolderName || '',
            cardNumberMasked: input.cardNumber ? this.maskCard(input.cardNumber) : '',
            expiryDate: input.expiryDate || '',
            isEasyFinoraVerified: methodKey !== 'easyfinora',
            verificationMessage: methodKey === 'easyfinora' ? 'Saved locally (backend sync pending)' : 'Ready',
            paymentDetails: methodKey === 'easyfinora'
                ? `EasyFinora Wallet ID: ${input.walletId || ''}`
                : (input.walletId || '')
        };

        localStorage.setItem(this.localKey, JSON.stringify(dto));
        return dto;
    }

    private shouldFallbackToLocal(err: any): boolean {
        const status = Number(err?.status ?? 0);
        if (status === 404 || status === 0) return true;
        if (status >= 500) return true;
        if (err?.name === 'TimeoutError') return true;
        return false;
    }

    private isEndpointDisabled(kind: 'get' | 'save'): boolean {
        const state = this.readEndpointState();
        const now = Date.now();
        const until = kind === 'get' ? state.getDisabledUntil : state.saveDisabledUntil;
        return !!until && now < until;
    }

    private disableEndpoint(kind: 'get' | 'save'): void {
        const state = this.readEndpointState();
        const until = Date.now() + this.disableMs;
        if (kind === 'get') {
            state.getDisabledUntil = until;
        } else {
            state.saveDisabledUntil = until;
        }
        localStorage.setItem(this.endpointStateKey, JSON.stringify(state));
    }

    private reEnableEndpoints(): void {
        localStorage.removeItem(this.endpointStateKey);
    }

    private readEndpointState(): { getDisabledUntil?: number; saveDisabledUntil?: number } {
        try {
            const raw = localStorage.getItem(this.endpointStateKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return {
                getDisabledUntil: Number(parsed?.getDisabledUntil || 0) || undefined,
                saveDisabledUntil: Number(parsed?.saveDisabledUntil || 0) || undefined
            };
        } catch {
            return {};
        }
    }

    private maskCard(card: string): string {
        const digits = (card || '').replace(/\D/g, '');
        if (digits.length < 4) return '';
        return `**** **** **** ${digits.slice(-4)}`;
    }

    private maskTail(value: string, visibleTail: number = 4): string {
        const digits = (value || '').replace(/\D/g, '');
        if (!digits) return '';
        if (digits.length <= visibleTail) return digits;
        return `${'*'.repeat(digits.length - visibleTail)}${digits.slice(-visibleTail)}`;
    }
}
