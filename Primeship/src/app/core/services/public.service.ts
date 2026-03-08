import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, throwError, shareReplay, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CategoryDto } from './category.service';
import { ProductDto } from './product.service';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class PublicService {
    private apiUrl = `${environment.apiUrl}/services/app/Public`;
    private tenantId = '2'; // Prime Ship Tenant
    private cachedCategories$: Observable<CategoryDto[]> | null = null;

    constructor(private http: HttpClient) { }

    getCategories(): Observable<CategoryDto[]> {
        if (!this.cachedCategories$) {
            this.cachedCategories$ = this.http.get<any>(this.apiUrl + '/GetCategories', {
                headers: new HttpHeaders({ 'Abp-TenantId': this.tenantId })
            }).pipe(
                map(res => {
                    const data = res?.result?.items || res?.result || res;
                    return Array.isArray(data) ? data : (data?.items || []);
                }),
                shareReplay(1),
                catchError(err => {
                    this.cachedCategories$ = null;
                    console.error('PublicService: GetCategories Error', err);
                    return throwError(() => err);
                })
            );
        }
        return this.cachedCategories$;
    }

    getProducts(searchTerm?: string, skipCount: number = 0, maxResultCount: number = 8): Observable<ProductDto[]> {
        let url = this.apiUrl + '/GetProducts?skipCount=' + skipCount + '&maxResultCount=' + maxResultCount;
        if (searchTerm) {
            url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
        }
        return this.http.get<any>(url, {
            headers: new HttpHeaders({ 'Abp-TenantId': this.tenantId })
        }).pipe(
            map(res => {
                const data = res?.result?.items || res?.result || res;
                return Array.isArray(data) ? data : (data?.items || []);
            }),
            catchError(err => {
                console.error('PublicService: GetProducts Error', err);
                return throwError(() => err);
            })
        );
    }


    getProductBySlug(slug: string): Observable<ProductDto> {
        return this.http.get<any>(`${this.apiUrl}/GetProductBySlug?slug=${slug}`, {
            headers: new HttpHeaders({ 'Abp-TenantId': this.tenantId })
        }).pipe(
            map(res => {
                const result = res?.result || res;
                if (!result || result.error) throw new Error('Product not found');
                return result;
            }),
            catchError(err => {
                console.warn(`⚠️ GetProductBySlug failed for [${slug}]. Attempting fallback search...`);

                // Fallback: Search for the product using the slug (replacing dashes with spaces)
                const searchTerm = slug.replace(/-/g, ' ');
                return this.getProducts(searchTerm).pipe(
                    map(products => {
                        const found = products.find(p => p.slug === slug || p.name?.toLowerCase() === searchTerm.toLowerCase());
                        if (found) return found;
                        throw err; // Re-throw original error if fallback also fails
                    })
                );
            })
        );
    }

    getProductDetail(productId: string): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/GetProductById?productId=${productId}`, {
            headers: new HttpHeaders({ 'Abp-TenantId': this.tenantId })
        }).pipe(
            map(res => res?.result || res),
            catchError(err => {
                console.error(`❌ getProductDetail failed for ID [${productId}]`, err);
                return throwError(() => err);
            })
        );
    }

    getProductFromMarketplace(productId: string): Observable<any> {
        return this.http.get<any>(`${environment.apiUrl}/services/app/ResellerMarketplace/GetProductDetails?productId=${productId}`, {
            headers: new HttpHeaders({ 'Abp-TenantId': this.tenantId })
        }).pipe(
            map(res => res?.result || res),
            catchError(err => {
                console.error(`❌ getProductFromMarketplace failed for ID [${productId}]`, err);
                return throwError(() => err);
            })
        );
    }

    getProductBySku(sku: string): Observable<ProductDto> {
        return this.http.get<any>(`${this.apiUrl}/GetProductBySku?sku=${sku}`, {
            headers: new HttpHeaders({ 'Abp-TenantId': this.tenantId })
        }).pipe(
            map(res => res?.result || res),
            catchError(err => {
                console.error(`❌ getProductBySku failed for SKU [${sku}]`, err);
                return throwError(() => err);
            })
        );
    }


    getProductsByCategory(slug: string, searchTerm?: string, categoryId?: string): Observable<ProductDto[]> {
        let url = `${this.apiUrl}/GetProductsByCategory?`;

        if (categoryId) {
            url += `categoryId=${categoryId}`;
        } else {
            url += `categorySlug=${slug}`;
        }

        if (searchTerm) {
            url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
        }
        return this.http.get<any>(url, {
            headers: new HttpHeaders({ 'Abp-TenantId': this.tenantId })
        }).pipe(
            map(res => {
                const data = res?.result?.items || res?.result || res;
                return Array.isArray(data) ? data : (data?.items || []);
            }),
            catchError(err => {
                console.error('PublicService: GetProductsByCategory Error', err);
                return throwError(() => err);
            })
        );
    }

    getProfile(): Observable<any> {
        const token = localStorage.getItem('authToken');
        return this.http.get<any>(`${this.apiUrl}/GetProfile`, {
            headers: new HttpHeaders({
                'Authorization': `Bearer ${token}`,
                'Abp-TenantId': this.tenantId
            })
        }).pipe(
            map(res => res?.result || res),
            catchError(err => {
                console.error('PublicService: GetProfile Error', err);
                return throwError(() => err);
            })
        );
    }
}
