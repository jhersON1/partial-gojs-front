import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { AuthStatus } from '../interfaces';

export const isAuthenticatedGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('Guard executing. Auth status:', authService.authStatus());

  if (authService.authStatus() === AuthStatus.authenticated) {
    console.log('User authenticated, allowing navigation');
    return true;
  }

  console.log('User not authenticated, redirecting to login');
  router.navigate(['/auth/login']);
  return false;
};
