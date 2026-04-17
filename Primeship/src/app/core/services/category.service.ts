import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

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

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

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
        const payload = this.normalizePayload(input);
        return this.http.post<any>(this.apiUrl + '/Create', payload, {
            headers: this.getHeaders()
        }).pipe(
            map(response => response.result)
        );
    }

    /**
     * Update existing category
     */
    update(input: UpdateCategoryDto): Observable<CategoryDto> {
        const payload = this.normalizePayload(input);
        return this.http.put<any>(this.apiUrl + '/Update', payload, {
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
        const slug = name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        return slug || 'category';
    }

    /**
     * Normalize category payload so the API receives a stable shape.
     */
    private normalizePayload<T extends { name: string; slug?: string; imageUrl?: string | null }>(input: T): T {
        const { ...rest } = input as any;
        const name = String(rest.name ?? '').trim();
        const slug = String(rest.slug ?? '').trim() || this.generateSlug(name);
        const imageUrl = String(rest.imageUrl ?? '').trim();

        return {
            ...rest,
            tenantId: Number(rest.tenantId ?? this.tenantId),
            name,
            slug,
            imageUrl: imageUrl || undefined
        };
    }

    /**
     * Get headers with tenant ID and auth token
     */
    private getHeaders(): HttpHeaders {
        return this.authService.getAuthHeaders();
    }
}
