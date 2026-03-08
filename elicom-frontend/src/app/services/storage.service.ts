import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StorageService {
    private readonly tokenKey = 'authToken';
    private readonly userIdKey = 'userId';
    private readonly userEmailKey = 'userEmail';
    private readonly currentUserKey = 'currentUser';

    getToken(): string | null {
        return this.getItem(this.tokenKey);
    }

    getItem(key: string): string | null {
        return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    }

    setItem(key: string, value: string, remember: boolean) {
        const store = remember ? localStorage : sessionStorage;
        store.setItem(key, value);
    }

    setAuthSession(token: string, userId: string | number, email: string, remember: boolean) {
        this.setItem(this.tokenKey, token, remember);
        this.setItem(this.userIdKey, String(userId), remember);
        this.setItem(this.userEmailKey, email, remember);
    }

    clearAuthSession() {
        [this.tokenKey, this.userIdKey, this.userEmailKey, this.currentUserKey].forEach(k => {
            sessionStorage.removeItem(k);
            localStorage.removeItem(k);
        });
    }
}
