import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';
import { resolveTenantId } from '../shared/platform-context';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const storage = inject(StorageService);
    const authService = inject(AuthService);
    let token = storage.getToken();

    if (token && authService.isTokenExpired(token)) {
        authService.handleUnauthorized();
        token = null;
    }

    // List of public endpoints that should NOT have the auth token attached
    const publicEndpoints = [
        '/api/TokenAuth/Authenticate',
        '/api/services/app/Account/Register',
        '/api/services/app/Account/RegisterSmartStoreCustomer',
        '/api/services/app/Account/ForgotPassword',
        '/api/services/app/Account/ResetPassword'
    ];

    // Check if the request URL matches any public endpoint
    const isPublic = publicEndpoints.some(url => req.url.includes(url));

    const tenantId = resolveTenantId();
    const cultureHeaders = { 'Accept-Language': 'en-US', 'Abp.Localization.CultureName': 'en' };

    const withCulture = req.clone({ setHeaders: cultureHeaders });

    if (token && !isPublic) {
        const cloned = withCulture.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`,
                'Abp-TenantId': tenantId,
                ...cultureHeaders
            }
        });
        return next(cloned).pipe(
            catchError((error: HttpErrorResponse) => {
                if (error.status === 401) {
                    authService.handleUnauthorized();
                }
                return throwError(() => error);
            })
        );
    }

    return next(withCulture);
};
