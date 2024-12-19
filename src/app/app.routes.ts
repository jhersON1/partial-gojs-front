import { Routes } from '@angular/router';
import { isNotAuthenticatedGuard } from './auth/guards';

export const routes: Routes = [
    {
        path: 'auth',
        //canActivate: [isNotAuthenticatedGuard],
        loadChildren: () => import('./auth/auth.routes').then(m => m.authRoutes)
    },
    {
        path: 'diagrams',
        //canActivate: [isAuthenticatedGuard],
        loadChildren: () => import('./features/diagrams/diagrams.routes').then(m => m.diagramRoutes)
    },
    {
        path: '**',
        redirectTo: 'auth'
    },
];
