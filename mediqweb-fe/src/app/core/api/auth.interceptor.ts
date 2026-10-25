import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export function authInterceptor(req: HttpRequest<any>, next: HttpHandlerFn) {
  const authService = inject(AuthService);
  const token = authService.accessToken;

  const headers = token ? req.headers.set('Authorization', `Bearer ${token}`) : req.headers;
  const authReq = req.clone({ headers });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        return authService.refresh().pipe(
          switchMap(() => {
            const newToken = authService.accessToken;
            const retryReq = req.clone({
              headers: req.headers.set('Authorization', `Bearer ${newToken}`),
            });
            return next(retryReq);
          }),
          catchError(() => {
            authService.signOut();
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
}

export const AUTH_INTERCEPTOR_PROVIDER = { provide: 'AUTH_INTERCEPTOR', useValue: authInterceptor };
