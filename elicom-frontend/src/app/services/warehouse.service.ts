import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WarehouseDto {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    storeId: string;
    isDefault: boolean;
    status: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class WarehouseService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/api/services/app/Warehouse`;

    create(input: any): Observable<WarehouseDto> {
        return this.http.post<any>(`${this.baseUrl}/Create`, input)
            .pipe(map(res => res.result));
    }

    update(input: WarehouseDto): Observable<WarehouseDto> {
        return this.http.put<any>(`${this.baseUrl}/Update`, input)
            .pipe(map(res => res.result));
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/Delete`, { params: { id } });
    }

    getByStore(storeId: string): Observable<WarehouseDto[]> {
        return this.http.get<any>(`${this.baseUrl}/GetByStore`, { params: { storeId } })
            .pipe(map(res => res.result || []));
    }

    get(id: string): Observable<WarehouseDto> {
        return this.http.get<any>(`${this.baseUrl}/Get`, { params: { id } })
            .pipe(map(res => res.result));
    }
}
