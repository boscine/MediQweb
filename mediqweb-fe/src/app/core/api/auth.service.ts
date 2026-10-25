import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs';
import { AuthSession } from './models';
import { AuthState } from './auth.state';
import { environment } from '../../../environments/environment';

const SIGN_IN = `${environment.bffBaseUrl}/auth/sign-in`;
const REFRESH = `${environment.bffBaseUrl}/auth/refresh`;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private authState = inject(AuthState);

  signIn(username: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(SIGN_IN, { username, password }).pipe(
      tap((session) => this.authState.setSession(session)),
    );
  }

  setSessionFromGateway(session: AuthSession): void {
    this.authState.setSession(session);
  }

  refresh(): Observable<AuthSession> {
    return this.http.post<AuthSession>(REFRESH, {}).pipe(
      tap((session) => this.authState.setSession(session)),
      catchError(() => {
        this.authState.clear();
        return of(null as unknown as AuthSession);
      }),
    );
  }

  signOut(): void {
    this.authState.clear();
  }

  get accessToken(): string | null {
    return this.authState.accessToken;
  }

  get profile() {
    return this.authState.profile;
  }

  get isAuthenticated$(): Observable<boolean> {
    return this.authState.isAuthenticated;
  }
}
