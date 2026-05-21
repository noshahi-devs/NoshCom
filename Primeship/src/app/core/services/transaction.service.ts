import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class TransactionService {
    private apiUrl = `${environment.apiUrl}/services/app/Transaction`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    getHistory(skipCount: number = 0, maxResultCount: number = 10): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetHistory`, {
            headers: this.authService.getAuthHeaders(),
            params: { skipCount, maxResultCount }
        });
    }

    getAllTransactions(skipCount: number = 0, maxResultCount: number = 50): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetAll`, {
            headers: this.authService.getAuthHeaders(),
            params: { skipCount, maxResultCount }
        });
    }
}
