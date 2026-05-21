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
        );
    }

    /**
     * Complete MFA step after admin login (same Authenticate endpoint).
     */
    verifyMfaLogin(
        credentials: LoginInput,
        mfaChallengeId: string,
        mfaCode: string
    ): Observable<any> {
        return this.http.post<any>(
            `${this.apiUrl}/TokenAuth/Authenticate`,
            {
                userNameOrEmailAddress: credentials.userNameOrEmailAddress,
                password: credentials.password,
                rememberClient: credentials.rememberClient ?? false,
                mfaChallengeId,
                mfaCode
            },
            { headers: this.getTenantHeaders() }
        );
    }

    /**
     * Persist token from a successful Authenticate response.
     */
    storeTokenFromResponse(response: any): boolean {
        const result = response?.result;
        if (!result?.accessToken) {
            return false;
        }

        this.setToken(result.accessToken);
        if (result.userId) {
            this.setUserId(result.userId.toString());
        }

        const roles = this.getUserRoles();
        if (roles?.length) {
            localStorage.setItem('userRoles', JSON.stringify(roles));
        }

        this.currentUserSubject.next({
            token: result.accessToken,
            userId: result.userId,
            roles
        });

        return true;
    }

    isMfaRequired(response: any): boolean {
        return !!response?.result?.mfaRequired && !!response?.result?.mfaChallengeId;
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
        return !!this.getBearerToken();
    }

    getTenantId(): string {
        return this.tenantId;
    }

    /**
     * Get stored token
     */
    getToken(): string | null {
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    }

    /**
     * Bearer token for API calls (validated loosely so login tokens are not dropped).
     */
    getBearerToken(): string | null {
        const raw = this.getToken();
        if (!raw) {
            return null;
        }

        let token = raw.trim();
        token = token.replace(/^Bearer\s+/i, '').trim();
        token = token.replace(/^"+|"+$/g, '').trim();

        if (!token || token === 'null' || token === 'undefined') {
            return null;
        }

        return token;
    }

    handleUnauthorized(): void {
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('authToken');
        this.currentUserSubject.next(null);

        if (!this.router.url.startsWith('/auth/login')) {
            this.router.navigate(['/auth/login'], {
                queryParams: { returnUrl: this.router.url, reason: 'session-expired' }
            });
        }
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
        if (this.hasRole('Admin')) {
            return true;
        }

        const email = (this.getUserEmail() || localStorage.getItem('userEmail') || '').trim().toLowerCase();
        return this.isAdminEmail(email);
    }

    isAdminEmail(email: string): boolean {
        const normalized = (email || '').trim().toLowerCase();
        if (!normalized) {
            return false;
        }

        const allowlisted = [
            'secureadmin@ps.com',
            'secureadmin@ef.com',
            'admin@primeshipuk.com',
            'ps_secureadmin@ps.com',
            'gp_secureadmin@ef.com'
        ];

        return allowlisted.includes(normalized) ||
            normalized.startsWith('admin@') && normalized.includes('primeship');
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
        const token = this.getBearerToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Abp-TenantId': this.tenantId
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return new HttpHeaders(headers);
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
