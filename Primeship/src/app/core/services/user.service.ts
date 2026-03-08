import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface UserDto {
    id: number;
    userName: string;
    name: string;
    surname: string;
    emailAddress: string;
    isActive: boolean;
    fullName: string;
    lastLoginTime?: Date;
    creationTime: Date;
    roleNames: string[];
}

export interface CreateUserDto {
    userName: string;
    name: string;
    surname: string;
    emailAddress: string;
    isActive: boolean;
    roleNames: string[];
    password?: string;
}

export interface UpdateUserDto extends CreateUserDto {
    id: number;
}

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private apiUrl = `${environment.apiUrl}/services/app/User`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    getAll(keyword?: string, isActive?: boolean): Observable<UserDto[]> {
        let params: any = {
            maxResultCount: 1000,
            skipCount: 0
        };
        if (keyword) params.keyword = keyword;
        if (isActive !== undefined) params.isActive = isActive;

        return this.http.get<any>(`${this.apiUrl}/GetAll`, {
            params,
            headers: this.authService.getAuthHeaders()
        }).pipe(
            map(response => response?.result?.items || [])
        );
    }

    get(id: number): Observable<UserDto> {
        return this.http.get<any>(`${this.apiUrl}/Get`, {
            params: { id: id.toString() },
            headers: this.authService.getAuthHeaders()
        }).pipe(map(response => response?.result));
    }

    create(input: CreateUserDto): Observable<UserDto> {
        return this.http.post<any>(`${this.apiUrl}/Create`, input, {
            headers: this.authService.getAuthHeaders()
        }).pipe(map(response => response?.result));
    }

    update(input: UpdateUserDto): Observable<UserDto> {
        return this.http.put<any>(`${this.apiUrl}/Update`, input, {
            headers: this.authService.getAuthHeaders()
        }).pipe(map(response => response?.result));
    }

    delete(id: number): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/Delete`, {
            params: { id: id.toString() },
            headers: this.authService.getAuthHeaders()
        });
    }

    activate(id: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/Activate`, { id }, {
            headers: this.authService.getAuthHeaders()
        });
    }

    deactivate(id: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/DeActivate`, { id }, {
            headers: this.authService.getAuthHeaders()
        });
    }
}
