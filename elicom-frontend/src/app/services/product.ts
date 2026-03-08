import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProductCardDto {
    id: any | string;
    productName: any;
    productId: string;
    storeProductId: string;
    categoryId: string;
    categoryName: string;
    title: string;
    image1: string;
    image2: string;
    originalPrice: number;
    resellerDiscountPercentage: number;
    price: number;
    storeName: string;
    slug: string;
}

export interface ProductDetailDto {
    productId: string;
    storeProductId?: string;
    title: string;
    slug: string;
    description: string;
    brandName: string;
    images: string[];
    sizeOptions: string[];
    colorOptions: string[];
    category: {
        categoryId: string;
        name: string;
        slug: string;
    };
    store: {
        storeId: string;
        storeName: string;
        storeDescription: string;
        storeSlug: string;
        resellerPrice: number;
        resellerDiscountPercentage: number;
        price: number;
        stockQuantity: number;
    };
    otherStores: any[];
    totalOtherStores: number;
}

export interface GlobalMarketplaceProduct {
    storeName: string;
    storeSlug: string;
    productName: string;
    productImage: string;
    price: number;
    stockQuantity: number;
    categoryName: string;
    productId: string;
    id: string; // This is StoreProductId
}

@Injectable({
    providedIn: 'root'
})
export class ProductService {
    private apiUrl = `${environment.apiUrl}/api/services/app/Homepage`;
    private publicApiUrl = `${environment.apiUrl}/api/services/app/SmartStorePublic`;

    constructor(private http: HttpClient) { }

    getGlobalMarketplaceProducts(): Observable<GlobalMarketplaceProduct[]> {
        return this.http.get<any>(`${this.publicApiUrl}/GetGlobalMarketplaceProducts`)
            .pipe(
                map(res => {
                    console.log('Global Products Raw:', res);
                    if (res && res.result) {
                        if (Array.isArray(res.result)) return res.result;
                        if (res.result.items && Array.isArray(res.result.items)) return res.result.items;
                    }
                    return [];
                }),
                catchError(err => {
                    console.error('getGlobalMarketplaceProducts Network Error:', err);
                    return of([]);
                })
            );
    }

    getProductsForCards(skipCount: number = 0, maxResultCount: number = 10): Observable<{ totalCount: number, items: ProductCardDto[] }> {
        return this.http.get<any>(`${this.apiUrl}/GetAllProductsForCards`, {
            params: {
                skipCount: skipCount.toString(),
                maxResultCount: maxResultCount.toString()
            }
        }).pipe(
            map(res => res.result)
        );
    }

    getProductDetail(productId: string, storeProductId: string): Observable<ProductDetailDto | null> {
        console.log(`fetching ProductDetail for Product:${productId}, StoreProduct:${storeProductId}`);
        return this.http.get<any>(`${this.apiUrl}/GetProductDetail`, {
            params: {
                productId: productId,
                storeProductId: storeProductId
            }
        }).pipe(
            map(res => {
                console.log('ProductDetail API Response:', res);
                return res.result;
            }),
            catchError(err => {
                console.error('getProductDetail API Error:', err);
                return of(null);
            })
        );
    }

    getCategoriesWithListedProducts(): Observable<any[]> {
        return this.http.get<any>(`${this.apiUrl}/GetCategoriesWithListedProducts`)
            .pipe(map(res => res.result));
    }
}
