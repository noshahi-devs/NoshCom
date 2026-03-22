import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs/operators';

export interface CategoryDto {
    id: string;
    tenantId?: number;
    name: string;
    slug: string;
    imageUrl: string;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
    creationTime?: string;
    lastModificationTime?: string;
    productCount?: number;
    parentId?: any; // For template compatibility (not used in current model)
}

export interface CategoryLookupDto {
    id: string;
    name: string;
    slug: string;
}


export interface CreateCategoryDto {
    tenantId?: number;
    name: string;
    slug?: string;
    imageUrl?: string;
    status: boolean;
}

export interface UpdateCategoryDto {
    id: string;
    tenantId?: number;
    name: string;
    slug?: string;
    imageUrl?: string;
    status: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private apiUrl = `${environment.apiUrl}/services/app/Category`;
    private tenantId = '2'; // Prime Ship Tenant

    constructor(private http: HttpClient) { }

    /**
     * Get all categories
     */
    getAll(): Observable<CategoryDto[]> {
        return this.http.get<any>(this.apiUrl + '/GetAll', {
            headers: this.getHeaders()
        }).pipe(
            map(response => response.result.items || [])
        );
    }

    /**
     * Get simplified category list for lookups
     */
    getLookup(): Observable<CategoryLookupDto[]> {
        return this.http.get<any>(this.apiUrl + '/GetLookup', {
            headers: this.getHeaders()
        }).pipe(
            map(response => response.result.items || [])
        );
    }

    /**
     * Get category by ID
     */
    get(id: string): Observable<CategoryDto> {
        return this.http.get<any>(`${this.apiUrl}/Get?id=${id}`, {
            headers: this.getHeaders()
        }).pipe(
            map(response => response.result)
        );
    }

    /**
     * Create new category
     */
    create(input: CreateCategoryDto): Observable<CategoryDto> {
        // Auto-generate slug if not provided
        if (!input.slug) {
            input.slug = this.generateSlug(input.name);
        }

        return this.http.post<any>(this.apiUrl + '/Create', input, {
            headers: this.getHeaders()
        }).pipe(
            map(response => response.result)
        );
    }

    /**
     * Update existing category
     */
    update(input: UpdateCategoryDto): Observable<CategoryDto> {
        // Auto-generate slug if not provided
        if (!input.slug) {
            input.slug = this.generateSlug(input.name);
        }

        return this.http.put<any>(this.apiUrl + '/Update', input, {
            headers: this.getHeaders()
        }).pipe(
            map(response => response.result)
        );
    }

    /**
     * Delete category
     */
    delete(id: string, forceDelete: boolean = false): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/Delete?id=${id}&forceDelete=${forceDelete}`, {
            headers: this.getHeaders()
        });
    }

    /**
     * Generate slug from name
     */
    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Get headers with tenant ID and auth token
     */
    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('authToken');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': this.tenantId,
            'Authorization': `Bearer ${token}`
        });
    }
}
