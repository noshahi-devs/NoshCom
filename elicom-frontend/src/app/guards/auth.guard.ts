import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StoreService } from '../services/store.service';
import { Observable, of, map, catchError } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {
    private router = inject(Router);
    private authService = inject(AuthService);
    private storeService = inject(StoreService);

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean {
        const url = state.url;

        if (!this.authService.isAuthenticated) {
            this.router.navigate(['/smartstore/login'], {
                queryParams: { returnUrl: state.url }
            });
            return false;
        }

        // --- Role-based authorization ---

        // ADMIN
        if (url.startsWith('/admin')) {
            if (this.authService.isAdmin()) return true;
            return this.redirectToDashboard();
        }

        // SELLER
        if (url.startsWith('/seller')) {
            // Admin can access everything
            if (this.authService.isAdmin()) return true;

            if (this.authService.isSeller()) {
                // If they are on the store creation page, let them through
                if (url.includes('store-creation')) return true;

                // For all other /seller routes, check if store exists
                return this.storeService.getMyStoreCached().pipe(
                    map(res => {
                        // Handle both wrapped { result: ... } and unwrapped responses
                        const store = res?.result || res;
                        if (store && store.id) {
                            return true; // Store exists, allow access
                        } else {
                            console.log('No store found, redirecting to store creation');
                            this.router.navigate(['/seller/store-creation']);
                            return false;
                        }
                    }),
                    catchError((err) => {
                        console.log('Error checking store:', err);
                        // Only redirect if it's truly a 'Not Found' or unauthorized, 
                        // otherwise let them through to avoid blocking on transient API errors
                        if (err.status === 404) {
                            this.router.navigate(['/seller/store-creation']);
                            return of(false);
                        }
                        return of(true);
                    })
                );
            }
            return this.redirectToDashboard();
        }

        // CUSTOMER
        if (url.startsWith('/customer')) {
            if (this.authService.isCustomer() || this.authService.isAdmin() || this.authService.isSeller()) {
                return true;
            }
            return this.redirectToDashboard();
        }

        return true;
    }

    private redirectToDashboard(): boolean {
        this.authService.navigateToDashboard();
        return false;
    }
}
