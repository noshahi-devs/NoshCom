import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private apiUrl = `${environment.apiUrl}/api/services/app/User`;

    constructor(private http: HttpClient) { }

    private getHeaders() {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': '3',
            'Authorization': `Bearer ${token}`
        });
    }

    getAllUsers(skipCount: number = 0, maxResultCount: number = 20, keyword: string = ''): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetAll`, {
            headers: this.getHeaders(),
            params: { skipCount, maxResultCount, keyword }
        });
    }

    activateUser(userId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/Activate`, { id: userId }, {
            headers: this.getHeaders()
        });
    }

    deactivateUser(userId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/DeActivate`, { id: userId }, {
            headers: this.getHeaders()
        });
    }
}
