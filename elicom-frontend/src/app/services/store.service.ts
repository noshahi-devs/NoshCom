import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay, tap, map, catchError, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface StoreDto {
    id: string;
    name: string;
    shortDescription: string;
    longDescription: string;
    description: string;
    slug: string;
    ownerId: number;
    status: boolean;
    isActive: boolean;
    isAdminActive: boolean;
    createdAt?: string;
    withdrawLimit?: number;
    withdrawAllowedUntil?: string;
    adminWithdrawRemarks?: string;
    walletBalance: number;
    totalOrders: number;
    shippedOrders: number;
    supportEmail?: string;
    instagram?: string;
    whatsapp?: string;
    kyc?: StoreKycDto;
}

export interface StoreKycDto {
    fullName: string;
    cnic: string;
    expiryDate: string;
    issueCountry: string;
    dob: string;
    phone: string;
    address: string;
    zipCode: string;
    frontImage: string;
    backImage: string;
    status: boolean;
}

export interface CreateStoreDto {
    name: string;
    shortDescription: string;
    longDescription: string;
    description?: string;
    slug: string;
    supportEmail: string;
    instagram?: string;
    whatsapp?: string;
    ownerId: number;
    status: boolean;
    isActive: boolean;
    kyc: StoreKycDto;
}

export interface UpdateWithdrawPermissionInput {
    storeId: string;
    withdrawLimit?: number;
    withdrawAllowedUntil?: string;
    adminWithdrawRemarks?: string;
}

@Injectable({
    providedIn: 'root'
})
export class StoreService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/api/services/app/Store`;
    private myStore$?: Observable<any>;
    private readonly cacheKey = 'myStore';

    getStore(id: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/Get`, { params: { id } });
    }

    getAllStores(): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetAll`);
    }

    getMyStore(): Observable<any> {
        return this.http.get(`${this.apiUrl}/GetMyStore`);
    }

    getMyStoreCached(forceRefresh = false): Observable<any> {
        if (forceRefresh) {
            this.myStore$ = undefined;
        }

        const cachedStore = this.getCachedStore();
        if (!forceRefresh && cachedStore) {
            this.myStore$ = of(cachedStore).pipe(
                shareReplay({ bufferSize: 1, refCount: false })
            );
            return this.myStore$;
        }

        if (!forceRefresh && this.myStore$) {
            return this.myStore$;
        }

        // Prefer resolving from GetAll to avoid hard dependency on GetMyStore behavior.
        // Fallback to GetMyStore only when owner resolution is not available.
        this.myStore$ = this.resolveOwnedStoreFromAllStores().pipe(
            switchMap(({ store, resolved }) => {
                if (store) return of(store);
                if (resolved) return of(null);
                return this.getMyStore().pipe(
                    map((res: any) => res?.result || res || null),
                    catchError(() => of(null))
                );
            }),
            tap((store) => {
                if (store) {
                    localStorage.setItem(this.cacheKey, JSON.stringify(store));
                }
            }),
            shareReplay({ bufferSize: 1, refCount: false })
        );

        return this.myStore$;
    }

    private resolveOwnedStoreFromAllStores(): Observable<{ store: any | null; resolved: boolean }> {
        return this.getAllStores().pipe(
            map((res: any) => {
                const payload = res?.result ?? res;
                const stores = Array.isArray(payload?.items)
                    ? payload.items
                    : (Array.isArray(payload) ? payload : []);

                const currentUserId = this.getCurrentUserId();
                if (!currentUserId) {
                    return { store: null, resolved: false };
                }

                return {
                    store: stores.find((s: any) => Number(s?.ownerId) === currentUserId) || null,
                    resolved: true
                };
            }),
            catchError(() => of({ store: null, resolved: false }))
        );
    }

    private getCurrentUserId(): number | null {
        try {
            const raw = localStorage.getItem('currentUser') ?? sessionStorage.getItem('currentUser');
            if (!raw) return null;
            const currentUser = JSON.parse(raw);
            const userId = Number(currentUser?.id);
            return Number.isFinite(userId) && userId > 0 ? userId : null;
        } catch {
            return null;
        }
    }

    private getCachedStore(): any | null {
        try {
            const raw = localStorage.getItem(this.cacheKey);
            if (!raw) return null;

            const store = JSON.parse(raw);
            if (!store) return null;

            const currentUserId = this.getCurrentUserId();
            const ownerId = Number(store?.ownerId);

            if (currentUserId && Number.isFinite(ownerId) && ownerId > 0 && ownerId !== currentUserId) {
                localStorage.removeItem(this.cacheKey);
                return null;
            }

            return store;
        } catch {
            return null;
        }
    }

    getCachedStoreId(): string | null {
        const store = this.getCachedStore();
        return store?.id || null;
    }

    clearMyStoreCache(): void {
        this.myStore$ = undefined;
        localStorage.removeItem(this.cacheKey);
    }

    createStore(input: CreateStoreDto): Observable<any> {
        return this.http.post(`${this.apiUrl}/Create`, input).pipe(
            tap((res: any) => {
                const store = res?.result || res;
                if (store?.id) {
                    localStorage.setItem(this.cacheKey, JSON.stringify(store));
                    this.myStore$ = of(store).pipe(
                        shareReplay({ bufferSize: 1, refCount: false })
                    );
                } else {
                    this.clearMyStoreCache();
                }
            })
        );
    }

    updateStore(input: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/Update`, input).pipe(
            tap(() => this.clearMyStoreCache())
        );
    }

    approveStore(id: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/Approve`, { id });
    }

    rejectStore(id: string, reason: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/Reject`, { id, reason });
    }

    verifyKyc(id: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/VerifyKyc`, { id });
    }

    toggleAdminStatus(storeId: string, isActive: boolean): Observable<any> {
        return this.http.post(`${this.apiUrl}/ToggleAdminStatus`, { storeId, isActive });
    }

    updateWithdrawPermission(input: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/UpdateWithdrawPermission`, input);
    }
}
