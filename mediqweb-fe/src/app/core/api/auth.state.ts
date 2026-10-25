import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Observable } from 'rxjs';
import { AuthSession, UserProfile } from './models';

@Injectable({ providedIn: 'root' })
export class AuthState {
  private session$ = new BehaviorSubject<AuthSession | null>(this.loadSession());

  private loadSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem('mediq_access_token');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private save(session: AuthSession): void {
    sessionStorage.setItem('mediq_access_token', JSON.stringify(session));
    sessionStorage.setItem('mediq_refresh_expires_at', session.refreshExpiresAt);
  }

  clear(): void {
    sessionStorage.removeItem('mediq_access_token');
    sessionStorage.removeItem('mediq_refresh_expires_at');
    sessionStorage.removeItem('mediq_profile');
    this.session$.next(null);
  }

  setSession(session: AuthSession): void {
    this.save(session);
    this.session$.next(session);
  }

  get accessToken(): string | null {
    return this.session$.value?.accessToken ?? null;
  }

  get isAuthenticated(): Observable<boolean> {
    return this.session$.pipe(map((s) => s != null), distinctUntilChanged());
  }

  get profile(): UserProfile | null {
    return this.session$.value?.profile ?? null;
  }

  get session(): Observable<AuthSession | null> {
    return this.session$;
  }
}
