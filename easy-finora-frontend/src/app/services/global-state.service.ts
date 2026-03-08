import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';

export interface UserSessionState {
    user: {
        id: number;
        name: string;
        surname: string;
        emailAddress: string;
        roleNames: string[];
        fullName?: string;
        phoneNumber?: string;
        country?: string;
    } | null;
    tenant: {
        id: number;
        name: string;
    } | null;
    application: any;
    isLoaded: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class GlobalStateService {

    private initialState: UserSessionState = {
        user: null,
        tenant: null,
        application: null,
        isLoaded: false
    };

    // BehaviorSubject to hold the current session state
    private sessionState$ = new BehaviorSubject<UserSessionState>(this.initialState);

    constructor(private storage: StorageService) {
        // Try to load from storage on service initialization
        this.loadFromStorage();
    }

    /**
     * Get the session state as an Observable
     */
    getSessionState(): Observable<UserSessionState> {
        return this.sessionState$.asObservable();
    }

    /**
     * Get the current session state value (synchronous)
     */
    getCurrentSessionValue(): UserSessionState {
        return this.sessionState$.value;
    }

    /**
     * Update the session state with new data
     */
    setSessionState(sessionData: any): void {
        const newState: UserSessionState = {
            user: sessionData.user || null,
            tenant: sessionData.tenant || null,
            application: sessionData.application || null,
            isLoaded: true
        };

        // Update BehaviorSubject
        this.sessionState$.next(newState);

        // Persist to localStorage
        this.saveToLocalStorage(newState);
    }

    /**
     * Check if session data is already loaded
     */
    isSessionLoaded(): boolean {
        return this.sessionState$.value.isLoaded;
    }

    /**
     * Get user info from current state
     */
    getUser(): any {
        return this.sessionState$.value.user;
    }

    /**
     * Get user roles from current state
     */
    getUserRoles(): string[] {
        return this.sessionState$.value.user?.roleNames || [];
    }

    /**
     * Check if user is admin
     */
    isAdmin(): boolean {
        const roles = this.getUserRoles();
        return roles.some(r => r.toLowerCase() === 'admin');
    }

    /**
     * Clear session state (on logout)
     */
    clearSession(): void {
        this.sessionState$.next(this.initialState);
        this.storage.clearAuthSession();
    }

    /**
     * Save session state to localStorage
     */
    private saveToLocalStorage(state: UserSessionState): void {
        try {
            this.storage.setSessionState(JSON.stringify(state));

            // Also save individual items for backward compatibility
            if (state.user) {
                const remember = !!localStorage.getItem('authToken');
                this.storage.setItem('userEmail', state.user.emailAddress, remember);
                this.storage.setUserRoles(JSON.stringify(state.user.roleNames), remember);
            }
        } catch (error) {
            console.error('Failed to save session to localStorage:', error);
        }
    }

    /**
     * Load session state from localStorage
     */
    private loadFromStorage(): void {
        try {
            const savedState = this.storage.getSessionState();
            if (savedState) {
                const state = JSON.parse(savedState);
                this.sessionState$.next(state);
            }
        } catch (error) {
            console.error('Failed to load session from localStorage:', error);
        }
    }
}
