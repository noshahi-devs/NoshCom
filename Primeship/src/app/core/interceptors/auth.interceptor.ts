import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    if (!req.url.includes('/api')) {
        return next(req);
    }

    const authService = inject(AuthService);
    const token = authService.getBearerToken();
    const tenantId = authService.getTenantId();

    let headers = req.headers;
    if (token && !headers.has('Authorization')) {
        headers = headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Abp-TenantId')) {
        headers = headers.set('Abp-TenantId', tenantId);
    }

    const xsrf = readCookie('XSRF-TOKEN');
    if (xsrf && !headers.has('X-XSRF-TOKEN')) {
        headers = headers.set('X-XSRF-TOKEN', xsrf);
    }

    return next(req.clone({ headers, withCredentials: true })).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status === 401 && err.error?.unAuthorizedRequest) {
                authService.handleUnauthorized();
            }
            return throwError(() => err);
        })
    );
};
