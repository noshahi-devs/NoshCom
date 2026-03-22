import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface ProductImportResult {
  sourceUrl: string;
  name?: string;
  brand?: string;
  description?: string;
  price?: number;
  listPrice?: number;
  currency?: string;
  categoryHint?: string;
  images?: string[];
  warning?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductImportService {
  private apiUrl = `${environment.apiUrl}/services/app/ProductImport/FetchProductByUrl`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  fetchProductByUrl(url: string): Observable<ProductImportResult> {
    const normalizedUrl = this.normalizeUrl(url);
    return this.http.post<any>(this.apiUrl, { url: normalizedUrl }, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(response => response?.result as ProductImportResult)
    );
  }

  private normalizeUrl(url: string): string {
    const trimmed = (url ?? '').trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    return `https://${trimmed}`;
  }
}
