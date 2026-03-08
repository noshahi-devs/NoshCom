import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private readonly tokenKey = 'authToken';
    private readonly userIdKey = 'userId';
    private readonly userEmailKey = 'userEmail';
    private readonly userRolesKey = 'userRoles';
    private readonly sessionStateKey = 'sessionState';

    getToken(): string | null {
        return this.getItem(this.tokenKey);
    }

    getItem(key: string): string | null {
        return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    }

    setItem(key: string, value: string, remember: boolean) {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(key, value);
    }

    removeItemEverywhere(key: string) {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    }

    setAuthSession(token: string, userId: string | number, email: string, remember: boolean) {
        this.setItem(this.tokenKey, token, remember);
        this.setItem(this.userIdKey, String(userId), remember);
        this.setItem(this.userEmailKey, email, remember);
    }

    clearAuthSession() {
        this.removeItemEverywhere(this.tokenKey);
        this.removeItemEverywhere(this.userIdKey);
        this.removeItemEverywhere(this.userEmailKey);
        this.removeItemEverywhere(this.userRolesKey);
        this.removeItemEverywhere(this.sessionStateKey);
    }

    setSessionState(state: string, remember?: boolean) {
        const storage = remember !== undefined
            ? (remember ? localStorage : sessionStorage)
            : this.getSessionStorage();
        storage.setItem(this.sessionStateKey, state);
    }

    getSessionState(): string | null {
        return this.getItem(this.sessionStateKey);
    }

    setUserRoles(rolesJson: string, remember?: boolean) {
        const storage = remember !== undefined
            ? (remember ? localStorage : sessionStorage)
            : this.getSessionStorage();
        storage.setItem(this.userRolesKey, rolesJson);
    }

    private getSessionStorage(): Storage {
        if (sessionStorage.getItem(this.tokenKey)) {
            return sessionStorage;
        }
        if (localStorage.getItem(this.tokenKey)) {
            return localStorage;
        }
        return sessionStorage;
    }
}
