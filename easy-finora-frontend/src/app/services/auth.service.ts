import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = `${environment.apiUrl}/api/services/app/Account`;

    constructor(private http: HttpClient) { }

    register(input: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/RegisterGlobalPayUser`, input, {
            headers: { 'Abp-TenantId': '3' }
        });
    }

    login(input: any): Observable<any> {
        return this.http.post(`${environment.apiUrl}/api/TokenAuth/Authenticate`, input, {
            headers: { 'Abp-TenantId': '3' }
        });
    }

    sendSampleEmail(): Observable<any> {
        return this.http.post(`${this.apiUrl}/SendSampleEmail`, {}, {
            headers: { 'Abp-TenantId': '3' }
        });
    }

    forgotPassword(email: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/ForgotPassword`, { emailAddress: email }, {
            headers: { 'Abp-TenantId': '3' }
        });
    }

    isTenantAvailable(tenancyName: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/IsTenantAvailable`, { tenancyName });
    }

    logout() {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('userEmail');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userRoles');
        localStorage.removeItem('sessionState');
    }

    isAuthenticated(): boolean {
        return !!(sessionStorage.getItem('authToken') || localStorage.getItem('authToken'));
    }
}
