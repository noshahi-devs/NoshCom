import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreateCustomerProfileDto {
    userId: number;
    fullName: string;
    email?: string;
    phoneNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    profilePictureUrl?: string;
}

export interface CustomerProfileDto extends CreateCustomerProfileDto {
    id: string; // Guid
}

@Injectable({
    providedIn: 'root'
})
export class CustomerProfileService {
    private baseUrl = `${environment.apiUrl}/api/services/app/CustomerProfile`;

    constructor(private http: HttpClient) { }

    createProfile(profile: CreateCustomerProfileDto): Observable<any> {
        return this.http.post(`${this.baseUrl}/Create`, profile);
    }

    updateProfile(profile: CustomerProfileDto): Observable<any> {
        return this.http.put(`${this.baseUrl}/Update`, profile);
    }

    deleteProfile(id: string): Observable<any> {
        return this.http.delete(`${this.baseUrl}/Delete`, { params: { id } });
    }

    getProfile(id: string): Observable<any> {
        return this.http.get(`${this.baseUrl}/Get`, { params: { id } });
    }

    getByUserId(userId: number): Observable<any> {
        return this.http.get(`${this.baseUrl}/GetByUserId`, { params: { userId: userId.toString() } });
    }
}
