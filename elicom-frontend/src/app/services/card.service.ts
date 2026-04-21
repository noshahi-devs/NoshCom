import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ValidateCardInput {
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    amount: number;
    sourcePlatform: string;
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
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/api/services/app/Card`;

    validateCard(input: ValidateCardInput): Observable<CardValidationResultDto> {
        return this.http.post<any>(`${this.apiUrl}/ValidateCard`, input).pipe(
            map(res => res.result)
        );
    }
}
