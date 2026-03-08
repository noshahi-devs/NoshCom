import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { tap } from 'rxjs';
import { AppPageLoaderService } from '../services/app-page-loader.service';

export const pageLoaderInterceptor: HttpInterceptorFn = (req, next) => {
    const loader = inject(AppPageLoaderService);
    const shouldTrack = loader.isNavigationCycleActive();
    let marked = false;

    return next(req).pipe(
        tap((event) => {
            if (!shouldTrack || marked) return;
            if (event.type === HttpEventType.Response) {
                marked = true;
                loader.markDataArrived();
            }
        })
    );
};
