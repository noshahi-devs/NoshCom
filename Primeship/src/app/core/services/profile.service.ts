import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface CustomerProfile {
    id: string;
    userId: number;
    fullName: string;
    email: string;
    phoneNumber: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

@Injectable({
    providedIn: 'root'
})
export class ProfileService {
    private apiUrl = `${environment.apiUrl}/services/app/CustomerProfile`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    getMyProfile(): Observable<CustomerProfile> {
        return this.http.get<any>(`${this.apiUrl}/GetMyProfile`, {
            headers: this.authService.getAuthHeaders()
        }).pipe(
            map(response => response.result)
        );
    }
}
