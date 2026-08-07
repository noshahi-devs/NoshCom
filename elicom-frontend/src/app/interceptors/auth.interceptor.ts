import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';
import { resolveTenantId } from '../shared/platform-context';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const storage = inject(StorageService);
    const authService = inject(AuthService);

    // List of public endpoints that should NOT have the auth token attached
    // and must NEVER trigger the "session expired" redirect (that flow would
    // wipe out the auth modal's error state right as a login/register error comes back).
    const publicEndpoints = [
        '/api/TokenAuth/Authenticate',
        '/api/services/app/Account/Register',
        '/api/services/app/Account/RegisterSmartStoreCustomer',
        '/api/services/app/Account/RegisterSmartStoreSeller',
        '/api/services/app/Account/RegisterPrimeShipCustomer',
        '/api/services/app/Account/RegisterPrimeShipSeller',
        '/api/services/app/Account/ForgotPassword',
        '/api/services/app/Account/ResetPassword'
    ];

    // Check if the request URL matches any public endpoint
    const isPublic = publicEndpoints.some(url => req.url.includes(url));

    let token = storage.getToken();

    if (!isPublic && token && authService.isTokenExpired(token)) {
        authService.handleUnauthorized();
        token = null;
    }

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
