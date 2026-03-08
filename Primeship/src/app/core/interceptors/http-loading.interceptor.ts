import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { HttpLoadingService } from '../services/http-loading.service';

export const httpLoadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('x-skip-button-loader')) {
    return next(req);
  }

  const loadingService = inject(HttpLoadingService);
  loadingService.start();

  return next(req).pipe(
    finalize(() => loadingService.stop())
  );
};
