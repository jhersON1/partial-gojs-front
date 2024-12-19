import { Component, inject, signal } from '@angular/core';
import { MaterialModules } from '../../../shared/material.module';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';


@Component({
  selector: 'app-login-page',
  imports: [MaterialModules, ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export default class LoginPageComponent {
  private fb: FormBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router: Router = inject(Router);
  
  hide = signal(true);
  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }

  public loginForm: FormGroup = this.fb.group({
    email: ['paul@gmail.com', [Validators.required, Validators.email]],
    password: ['Abc1234', [Validators.required, Validators.minLength(6)]],
  })

  public login() {
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password)
      .subscribe({
        next: () => {
          this.router.navigateByUrl('/diagram').then(success => {
            if (!success) {
              console.error('Navigation failed. Current auth status:', this.authService.authStatus());
            }
          });
        },
        error: (message) => {
          Swal.fire('Error', message, 'error').then(r => 'sweet alert it`s failing');
        }
      })
  }
}
