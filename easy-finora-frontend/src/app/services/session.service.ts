import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GlobalStateService } from './global-state.service';

@Injectable({
    providedIn: 'root'
})
export class SessionService {
    private apiUrl = `${environment.apiUrl}/api/services/app`;

    constructor(
        private http: HttpClient,
        private globalState: GlobalStateService
    ) { }

    private getHeaders() {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': '3',
            'Authorization': `Bearer ${token}`
        });
    }

    /**
     * Get current login information with caching via GlobalStateService
     * Only calls API if data is not already loaded
     */
    getCurrentLoginInformations(): Observable<any> {
        // Check if session is already loaded in global state
        if (this.globalState.isSessionLoaded()) {
            // Using cached session data
            const cachedData = this.globalState.getCurrentSessionValue();
            return of({
                result: {
                    user: cachedData.user,
                    tenant: cachedData.tenant,
                    application: cachedData.application
                }
            });
        }

        // If not loaded, fetch from API
        // Fetching session data from API
        return this.http.get(`${this.apiUrl}/Session/GetCurrentLoginInformations`, {
            headers: this.getHeaders()
        }).pipe(
            tap((response: any) => {
                // Cache the response in global state
                if (response?.result) {
                    this.globalState.setSessionState(response.result);
                    // Session data cached
                }
            }),
            catchError(error => {
                console.error('❌ Failed to fetch session data:', error);
                throw error;
            })
        );
    }

    /**
     * Force refresh session data from API (ignores cache)
     */
    refreshSessionData(): Observable<any> {
        // Force refreshing session data
        return this.http.get(`${this.apiUrl}/Session/GetCurrentLoginInformations`, {
            headers: this.getHeaders()
        }).pipe(
            tap((response: any) => {
                if (response?.result) {
                    this.globalState.setSessionState(response.result);
                    // Session data refreshed
                }
            })
        );
    }

    getUser(id: number): Observable<any> {
        return this.http.get(`${this.apiUrl}/User/Get`, {
            headers: this.getHeaders(),
            params: { Id: id }
        });
    }

    /**
     * Clear session cache (call on logout)
     */
    clearSession(): void {
        this.globalState.clearSession();
    }
}
