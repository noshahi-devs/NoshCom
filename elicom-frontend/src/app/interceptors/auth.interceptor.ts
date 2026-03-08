import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { StorageService } from '../services/storage.service';
import { resolveTenantId } from '../shared/platform-context';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const storage = inject(StorageService);
    const token = storage.getToken();

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

    if (token && !isPublic) {
        const cloned = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`,
                'Abp-TenantId': tenantId,
                ...cultureHeaders
            }
        });
        return next(cloned);
    }

    // attach safe culture headers even for public calls to avoid CultureNotFoundException
    return next(req.clone({ setHeaders: cultureHeaders }));
};
