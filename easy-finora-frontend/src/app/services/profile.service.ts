import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ProfileService {
    private apiUrl = `${environment.apiUrl}/api/services/app/CustomerProfile`;

    constructor(private http: HttpClient) { }

    private getHeaders() {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': '3',
            'Authorization': `Bearer ${token}`
        });
    }

    getMyProfile(): Observable<any> {
        // Return GetMyProfile from backend
        return this.http.get(`${this.apiUrl}/GetMyProfile`, {
            headers: this.getHeaders()
        });
    }
}
