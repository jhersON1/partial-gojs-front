import { Component, computed, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/services/auth.service';
import { AuthStatus } from './auth/interfaces';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private lastValidUrl: string | null = null;

  constructor() {
    // Guardar la última URL válida
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.lastValidUrl = event.url;
      }
    });
  }
  
  public finishedAuthCheck = computed<boolean>( () => {
    if ( this.authService.authStatus() === AuthStatus.checking ) {
      return false;
    }

    return true;
  });

  public authStatusChangedEffect = effect(() => {
  
    switch ( this.authService.authStatus() ) {
      case AuthStatus.checking:
        return;

      case AuthStatus.authenticated:
        const currentUrl = this.router.url;
        if (currentUrl.startsWith('/auth')) {
          this.router.navigateByUrl('/diagrams').then(() => true);
        }
        return;

      case AuthStatus.notAuthenticated:
        this.router.navigateByUrl('/auth/login').then(() => true);
        return;
    }
  });

}
