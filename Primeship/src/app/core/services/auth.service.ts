import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface RegisterInput {
    emailAddress: string;
    password: string;
    phoneNumber: string;
    country: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
}

export interface LoginInput {
    userNameOrEmailAddress: string;
    password: string;
    rememberClient?: boolean;
}

export interface AuthResponse {
    accessToken: string;
    encryptedAccessToken: string;
    expireInSeconds: number;
    userId: number;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = `${environment.apiUrl}`;
    private currentUserSubject = new BehaviorSubject<any>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    // Prime Ship is Tenant 2
    private tenantId = '2';

    constructor(
        private http: HttpClient,
        private router: Router
    ) {
        // Check if user is already logged in
        const token = this.getToken();
        if (token) {
            this.currentUserSubject.next({ token });
        }
    }

    /**
     * Register a new Prime Ship Seller
     */
    registerSeller(input: any): Observable<any> {
        let fullName = input.fullName;
        if (!fullName && (input.firstName || input.lastName)) {
            fullName = `${input.firstName || ''} ${input.lastName || ''}`.trim();
        }

        const data = {
            ...input,
            fullName: fullName || input.emailAddress || 'User'
        };
        return this.http.post(
            `${this.apiUrl}/services/app/Account/RegisterPrimeShipSeller`,
            data,
            {
                headers: this.getTenantHeaders()
            }
        );
    }

    /**
     * Register a new Prime Ship Customer
     */
    registerCustomer(input: any): Observable<any> {
        let fullName = input.fullName;
        if (!fullName && (input.firstName || input.lastName)) {
            fullName = `${input.firstName || ''} ${input.lastName || ''}`.trim();
        }

        const data = {
            ...input,
            fullName: fullName || input.emailAddress || 'User'
        };
        return this.http.post(
            `${this.apiUrl}/services/app/Account/RegisterPrimeShipCustomer`,
            data,
            {
                headers: this.getTenantHeaders()
            }
        );
    }

    /**
     * Login to Prime Ship
     */
    login(input: LoginInput): Observable<any> {
        console.log('🔐 AuthService.login called with:', { email: input.userNameOrEmailAddress });

        return this.http.post<any>(
            `${this.apiUrl}/TokenAuth/Authenticate`,
            input,
            {
                headers: this.getTenantHeaders()
            }
        ).pipe(
            tap(response => {
                console.log('📦 AuthService received response:', response);

                // API returns: { result: { accessToken, userId }, success, error }
                if (response && response.result && response.result.accessToken) {
                    console.log('✅ Valid token found in response.result');
                    console.log('💾 Storing token:', response.result.accessToken.substring(0, 20) + '...');
                    console.log('💾 Storing userId:', response.result.userId);

                    this.setToken(response.result.accessToken);
                    this.setUserId(response.result.userId.toString());

                    // Decode token to get roles early
                    const roles = this.getUserRoles();
                    if (roles) {
                        localStorage.setItem('userRoles', JSON.stringify(roles));
                    }

                    console.log('✅ Token stored in localStorage');
                    console.log('🔍 Verify token in localStorage:', localStorage.getItem('authToken')?.substring(0, 20) + '...');

                    this.currentUserSubject.next({
                        token: response.result.accessToken,
                        userId: response.result.userId,
                        roles: roles
                    });

                    console.log('✅ currentUserSubject updated');
                } else {
                    console.error('❌ Invalid response structure:', response);
                }
            })
        );
    }

    /**
     * Logout
     */
    logout(): void {
        localStorage.clear();
        sessionStorage.clear();
        this.currentUserSubject.next(null);
        this.router.navigate(['/auth/login']);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        const token = this.getToken();
        return !!token;
    }

    /**
     * Get stored token
     */
    getToken(): string | null {
        return localStorage.getItem('authToken');
    }

    /**
     * Set token
     */
    private setToken(token: string): void {
        localStorage.setItem('authToken', token);
    }

    /**
     * Set user ID
     */
    private setUserId(userId: string): void {
        localStorage.setItem('userId', userId);
    }

    /**
     * Get user ID
     */
    getUserId(): string | null {
        return localStorage.getItem('userId');
    }

    getUserName(): string | null {
        const token = this.getToken();
        if (!token) return null;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));

            // 1. Try standard 'name' claim (added in TokenAuthController)
            if (payload['name'] && !payload['name'].includes('@') && !payload['name'].includes('_')) {
                return payload['name'];
            }

            // 2. Extract GivenName and Surname
            const givenName = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || payload['givenname'];
            const surname = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || payload['surname'];

            if (givenName || surname) {
                const combined = `${givenName || ''} ${surname || ''}`.trim();
                // Avoid returning things that look like emails or internal usernames
                if (combined && !combined.includes('@')) return combined;
            }

            // Fallback to email
            return payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
                payload['email'] ||
                payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
                payload['name'];
        } catch (e) {
            console.error('Error decoding token for name:', e);
            return null;
        }
    }

    getUserEmail(): string | null {
        const payload = this.getDecodedTokenPayload();
        if (!payload) {
            return localStorage.getItem('userEmail');
        }

        return payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
            payload['email'] ||
            payload['emailaddress'] ||
            payload['preferred_username'] ||
            localStorage.getItem('userEmail');
    }

    getUserFirstName(): string | null {
        const payload = this.getDecodedTokenPayload();

        const givenName = payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] ||
            payload?.['givenname'];
        if (givenName && String(givenName).trim()) {
            return String(givenName).trim();
        }

        const displayName = this.getUserName();
        if (displayName && !displayName.includes('@')) {
            const first = displayName.trim().split(/\s+/)[0];
            if (first) {
                return first;
            }
        }

        const email = this.getUserEmail();
        if (email && email.includes('@')) {
            const localPart = email.split('@')[0]?.trim();
            if (localPart) {
                return localPart.charAt(0).toUpperCase() + localPart.slice(1);
            }
        }

        return null;
    }

    /**
     * Get user roles from JWT token
     */
    getUserRoles(): string[] {
        const token = this.getToken();
        if (!token) return [];

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            // ABP roles are usually in 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role' 
            // or just 'role' depending on configuration
            const rawRoles = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload['role'] || [];
            const rolesArray = Array.isArray(rawRoles) ? rawRoles : [rawRoles];

            return rolesArray
                .flatMap((role: any) =>
                    String(role ?? '')
                        .split(',')
                        .map((part: string) => part.trim())
                )
                .filter((role: string) => !!role);
        } catch (e) {
            console.error('Error decoding token:', e);
            return [];
        }
    }

    /**
     * Check if user has a specific role
     */
    hasRole(roleName: string): boolean {
        const target = roleName.toLowerCase();
        return this.getUserRoles().some(role => role.toLowerCase() === target);
    }

    isAdmin(): boolean {
        return this.hasRole('Admin');
    }

    isSeller(): boolean {
        return this.hasRole('Seller') || this.hasRole('Supplier');
    }

    isCustomer(): boolean {
        return this.hasRole('Buyer') || this.hasRole('Reseller');
    }

    /**
     * Get tenant headers for Prime Ship (Tenant 2)
     */
    private getTenantHeaders(): HttpHeaders {
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Abp-TenantId': this.tenantId
        });
    }

    /**
     * Get auth headers with token
     */
    getAuthHeaders(): HttpHeaders {
        const token = this.getNormalizedToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Abp-TenantId': this.tenantId
        };

        // Do not send a malformed bearer token (e.g. "Bearer null").
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return new HttpHeaders(headers);
    }

    private getNormalizedToken(): string | null {
        const raw = this.getToken();
        if (!raw) return null;

        let token = raw.trim();
        token = token.replace(/^Bearer\s+/i, '').trim();
        token = token.replace(/^"+|"+$/g, '').trim();

        // JWT should be 3 dot-separated base64url segments.
        if (!/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(token)) {
            return null;
        }

        return token;
    }

    private getDecodedTokenPayload(): any | null {
        const token = this.getToken();
        if (!token) return null;

        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            console.error('Error decoding token payload:', e);
            return null;
        }
    }
}
