import { Injectable } from "@angular/core";


@Injectable({
    providedIn: 'root'
  })
  export class UserService {

    checkUserEmail(email: string) {
      // Implementar la lógica para verificar si un usuario existe
      console.log('Verificando si el usuario existe:', email);
      return Promise.resolve(true);
    }
  }