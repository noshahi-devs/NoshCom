import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface ProductDto {
  id: string;
  tenantId?: number;
  name: string;
  sku: string;
  categoryId: string;
  categoryName?: string;
  description: string;
  images: string | string[];
  supplierPrice: number;
  resellerMaxPrice: number;
  discountPercentage: number;
  stockQuantity: number;
  status: boolean;
  slug: string;
  brandName?: string;
  sizeOptions?: string;
  colorOptions?: string;
  // Template compatibility properties
  category?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  featured?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdAt?: Date;
}

export interface CreateProductDto {
  tenantId?: number;
  name: string;
  sku: string;
  categoryId: string;
  description: string;
  images: string;
  supplierPrice: number;
  resellerMaxPrice: number;
  discountPercentage: number;
  stockQuantity: number;
  status: boolean;
  slug: string;
  brandName?: string;
}

export interface UpdateProductDto extends CreateProductDto {
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private publicApiUrl = `${environment.apiUrl}/services/app/Public`;
  private productApiUrl = `${environment.apiUrl}/services/app/Product`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  getAll(): Observable<ProductDto[]> {
    return this.http.get<any>(`${this.productApiUrl}/GetAll`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(response => {
        // Handle wrapped response: response.result.items or response.result
        if (response?.result?.items) {
          return response.result.items;
        }
        return response?.result || [];
      })
    );
  }

  get(id: string): Observable<ProductDto> {
    return this.http.get<any>(`${this.productApiUrl}/Get`, {
      params: { id },
      headers: this.authService.getAuthHeaders()
    }).pipe(map(response => response?.result));
  }

  create(input: CreateProductDto): Observable<ProductDto> {
    return this.http.post<any>(`${this.productApiUrl}/Create`, input, {
      headers: this.authService.getAuthHeaders()
    }).pipe(map(response => response?.result));
  }

  update(input: UpdateProductDto): Observable<ProductDto> {
    return this.http.put<any>(`${this.productApiUrl}/Update`, input, {
      headers: this.authService.getAuthHeaders()
    }).pipe(map(response => response?.result));
  }

  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${this.productApiUrl}/Delete`, {
      params: { id },
      headers: this.authService.getAuthHeaders()
    }); // Delete often returns empty result or success bool
  }

  getProductBySku(sku: string): Observable<any> {
    return this.http.get(`${this.publicApiUrl}/GetProductBySku`, {
      params: { sku },
      headers: this.authService.getAuthHeaders()
    });
  }

  searchProducts(term: string): Observable<ProductDto[]> {
    return this.http.get<any>(`${this.publicApiUrl}/GetProductsBySearch`, {
      params: { term },
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(response => {
        if (response?.result?.items) {
          return response.result.items;
        }
        return response?.result || [];
      })
    );
  }

  // Helper Utilities used by components
  parseImages(images: any): string[] {
    if (!images) return [];

    // If it's already an array, just return it
    if (Array.isArray(images)) return images;

    // If it's an object with Images or images property (PascalCase vs camelCase fallback)
    if (typeof images === 'object') {
      const val = images.images || images.Images;
      if (val) return this.parseImages(val);
    }

    if (typeof images !== 'string') return [];

    const trimmed = images.trim();
    if (!trimmed) return [];

    // Try parsing as JSON array
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') return [parsed];
    } catch (e) {
      // Not valid JSON, continue to raw string checks
    }

    // Handle single URL or raw Base64 string
    // Many older entries might just be a single string instead of a JSON array
    if (trimmed.startsWith('http') || trimmed.startsWith('data:image')) {
      return [trimmed];
    }

    // If it's a long string and doesn't look like JSON, it might be a raw base64 without prefix
    if (trimmed.length > 100) {
      return [trimmed];
    }

    return [];
  }

  stringifyImages(images: string[]): string {
    return JSON.stringify(images || []);
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  parseSizeOptions(options: any): string[] {
    if (!options) return [];
    if (Array.isArray(options)) return options;
    try {
      return JSON.parse(options);
    } catch (e) {
      return [];
    }
  }

  parseColorOptions(options: any): string[] {
    if (!options) return [];
    if (Array.isArray(options)) return options;
    try {
      return JSON.parse(options);
    } catch (e) {
      return [];
    }
  }
}
