import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthSession, UserProfile } from './models';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const SIGN_IN = `${environment.bffBaseUrl}/auth/sign-in`;
const ME = `${environment.bffBaseUrl}/me`;

@Injectable({ providedIn: 'root' })
export class HttpAuthGateway {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  signIn(username: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(SIGN_IN, { username, password }).pipe(
      tap((session) => this.authService.setSessionFromGateway(session)),
    );
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(ME);
  }
}
