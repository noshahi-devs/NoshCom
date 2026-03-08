import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserDto {
    id: number;
    userName: string;
    name: string;
    surname: string;
    emailAddress: string;
    isActive: boolean;
    fullName: string;
    lastLoginTime: string;
    creationTime: string;
    roleNames: string[];
}

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/api/services/app/User`;

    getAll(skipCount: number = 0, maxResultCount: number = 100): Observable<any> {
        return this.http.get<any>(`${this.baseUrl}/GetAll`, {
            params: { skipCount, maxResultCount }
        });
    }

    create(input: any): Observable<any> {
        return this.http.post(`${this.baseUrl}/Create`, input);
    }

    update(input: any): Observable<any> {
        return this.http.put(`${this.baseUrl}/Update`, input);
    }

    delete(id: number): Observable<any> {
        return this.http.delete(`${this.baseUrl}/Delete`, { params: { id } });
    }
}
