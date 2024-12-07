import { Routes } from '@angular/router';
import { isNotAuthenticatedGuard } from './auth/guards';

export const routes: Routes = [
    {
        path: 'auth',
        canActivate: [isNotAuthenticatedGuard],
        loadChildren: () => import('./auth/auth.routes').then(m => m.authRoutes)
    },
    {
        path: '**',
        redirectTo: 'auth'
    },
];
