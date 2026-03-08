import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface ValidateCardInput {
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    amount: number;
    sourcePlatform?: string;
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
        return this.http.post<any>(`${this.apiUrl}/ValidateCard`, input, {
            headers: this.authService.getAuthHeaders()
        }).pipe(
            map(response => response.result)
        );
    }
}
