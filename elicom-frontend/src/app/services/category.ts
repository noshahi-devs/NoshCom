import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay, retry, timer, delayWhen } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Category {
  name: string;
  slug: string;
  imageUrl: string;
  status?: boolean;
  createdAt?: string;
  updatedAt?: string;
  id?: string;
  categoryId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  private apiUrl = `${environment.apiUrl}/api/services/app/Category`;
  private homeUrl = `${environment.apiUrl}/api/services/app/Homepage/GetCategoriesWithListedProducts`;

  // Cache observables to prevent multiple simultaneous calls during page load/refresh
  private categoriesCache$?: Observable<any[]>;
  private homepageCategoriesCache$?: Observable<any[]>;

  constructor(private http: HttpClient) { }

  /**
   * Universal fetcher with automatic retry and caching logic
   */
  private fetchAndCache(url: string, logLabel: string): Observable<any[]> {
    return this.http.get<any>(url).pipe(
      // 1. Map results robustly
      map(res => {
        if (res && res.result) {
          if (Array.isArray(res.result)) return res.result;
          if (res.result.items && Array.isArray(res.result.items)) return res.result.items;
        }
        if (Array.isArray(res)) return res;
        return [];
      }),
      // 2. Retry logic: if fails, retry up to 3 times with 1s delay
      // Useful for cases where the backend is still warming up or under debugger pressure
      retry({
        count: 3,
        delay: 1000
      }),
      // 3. Share the result with all late subscribers (page refresh scenarios)
      shareReplay(1),
      // 4. Global error fallback
      catchError(err => {
        console.error(`${logLabel} Network Error after retries:`, err);
        return of([]);
      })
    );
  }

  getAllCategories(maxResultCount: number = 100): Observable<any[]> {
    if (!this.categoriesCache$) {
      this.categoriesCache$ = this.fetchAndCache(`${this.apiUrl}/GetAll?maxResultCount=${maxResultCount}`, 'GetAllCategories');
    }
    return this.categoriesCache$;
  }

  getHomepageCategories(): Observable<any[]> {
    if (!this.homepageCategoriesCache$) {
      this.homepageCategoriesCache$ = this.fetchAndCache(this.homeUrl, 'GetHomepageCategories');
    }
    return this.homepageCategoriesCache$;
  }

  getCategoryById(id: string): Observable<Category> {
    return this.http.get<any>(`${this.apiUrl}/Get?id=${id}`)
      .pipe(map(res => res.result));
  }

  /**
   * Force refresh the cache if needed manually
   */
  refreshCache() {
    this.categoriesCache$ = undefined;
    this.homepageCategoriesCache$ = undefined;
  }
}
