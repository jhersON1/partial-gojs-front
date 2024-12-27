import { Injectable } from "@angular/core";
import { FormGroup } from "@angular/forms";

@Injectable({
    providedIn: 'root'
  })
  export class ValidationsService {
    emailPattern: string = '^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$';
  
    getFieldError(form: FormGroup, field: string): string | null {
      const control = form.get(field);
      
      if (!control?.errors) return null;
      
      if (control.errors['required']) return 'Este campo es requerido';
      if (control.errors['pattern']) return 'Email inválido';
      if (control.errors['notRegistered']) return 'Usuario no registrado';
      
      return null;
    }
  
    fieldHasErros(form: FormGroup, field: string): boolean {
      return form.get(field)?.invalid && form.get(field)?.touched || false;
    }
  }