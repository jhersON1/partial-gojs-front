import { Routes } from '@angular/router';

export const diagramRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'class-diagram',
        loadComponent: () => import('./components/class-diagram/class-diagram.component')
          .then(m => m.ClassDiagramComponent)
      },
      {
        path: '',
        loadComponent: () => import('./pages/diagram-list/diagram-list.component')
          .then(m => m.DiagramListComponent)
      }
    ]
  }
];