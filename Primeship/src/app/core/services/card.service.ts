import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface ValidateCardInput {
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    amount: number;
}

export interface CardValidationResultDto {
    isValid: boolean;
    message: string;
    availableBalance: number;
}

@Injectable({
    providedIn: 'root'
})
export class CardService {
    private apiUrl = `${environment.apiUrl}/services/app/Card`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    validateCard(input: ValidateCardInput): Observable<CardValidationResultDto> {
        const payload: ValidateCardInput = {
            cardNumber: (input?.cardNumber ?? '').toString().replace(/\D/g, ''),
            expiryDate: (input?.expiryDate ?? '').toString().trim(),
            cvv: (input?.cvv ?? '').toString().replace(/\D/g, ''),
            amount: Number.isFinite(Number(input?.amount)) ? Number(input.amount) : 0
        };

        const tenantOnlyHeaders = new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': '2'
        });

        return this.http.post<any>(`${this.apiUrl}/ValidateCard`, payload, {
            headers: tenantOnlyHeaders
        }).pipe(
            map((response) => {
                const result = response?.result ?? response ?? {};
                return {
                    isValid: !!result.isValid,
                    message: result.message || 'Card verification completed.',
                    availableBalance: Number(result.availableBalance ?? 0)
                } as CardValidationResultDto;
            }),
            catchError((err: HttpErrorResponse) => {
                const parsed = this.tryParseJson(err.error);
                const enrichedError = new HttpErrorResponse({
                    error: parsed ?? {
                        error: {
                            message: err.message || 'Card verification failed.'
                        }
                    },
                    headers: err.headers,
                    status: err.status,
                    statusText: err.statusText,
                    url: err.url ?? undefined
                });
                return throwError(() => enrichedError);
            })
        );
    }

    private tryParseJson(raw: unknown): any {
        if (raw == null) return null;
        if (typeof raw === 'object') return raw;
        if (typeof raw !== 'string') return null;

        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
}
