import { HttpClient, HttpHeaders } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, throwError, catchError } from "rxjs";
import { environment } from "../../../../../environments/environments";
import { TokenService } from "../../../../../auth/services/token.service";
import { API_ROUTES } from "../../../../../core/constants";

interface UserCheckResponse {
  exists: boolean;
  email: string;
  nombre: string;
  apellido: string;
}

@Injectable({
    providedIn: 'root'
  })
  export class UserService {
    private readonly apiUrl: string = environment.baseUrl;
    private readonly tokenService: TokenService = inject(TokenService);
    private http = inject(HttpClient);
  
    checkUserEmail(email: string): Observable<UserCheckResponse> {
      const token = this.tokenService.getToken();
      if (!token) {
        return throwError(() => 'No hay token de autenticación');
      }
  
      const headers = new HttpHeaders()
        .set('Authorization', `Bearer ${token}`);
  
      return this.http.get<UserCheckResponse>(`${this.apiUrl}${API_ROUTES.CHECK_EMAIL}`, {
        headers,
        params: { email }
      }).pipe(
        catchError(error => {
          console.error('[UserService] Error checking email:', error);
          if (error.status === 404) {
            return throwError(() => 'El usuario no está registrado en el sistema');
          }
          if (error.status === 401) {
            return throwError(() => 'No autorizado');
          }
          return throwError(() => 'Error al verificar el usuario');
        })
      );
    }
  }