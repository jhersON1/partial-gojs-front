import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, filter, switchMap, take } from 'rxjs';
import { EditorService } from '../../services/editor.service';
import { UserService } from '../../services/user.service';
import { MaterialModules } from '../../../../../../shared/material.module';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ValidationsService } from '../../services/validation.service';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CollaborationService } from '../../../../../../shared/services/collaboration.service';

interface InvitationPermissions {
  allowEditing: boolean;
  allowInviting: boolean;
  allowDeleting: boolean;
}


@Component({
  selector: 'app-invite-dialog',
  imports: [MaterialModules, ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './invite-dialog.component.html',
  styleUrl: './invite-dialog.component.scss'
})
export class InviteDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly validationsService = inject(ValidationsService);
  private readonly userService = inject(UserService);
  //private readonly editorService = inject(EditorService);
  private readonly dialogRef = inject(MatDialogRef<InviteDialogComponent>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly collaborationService = inject(CollaborationService);
  
  protected invitationForm!: FormGroup;
  protected showUrlSection = false;
  protected collaborationUrl = '';
  protected isProcessing = false;
  protected verifiedEmails: Set<string> = new Set();
  protected readonly defaultPermissions: InvitationPermissions = {
    allowEditing: true,
    allowInviting: false,
    allowDeleting: false
  };

  ngOnInit(): void {
    this.initializeForm();
    this.setupEmailValidation();
  }

  private initializeForm(): void {
    this.invitationForm = this.fb.group({
      invitations: this.fb.array([]),
      ...this.defaultPermissions
    });
    this.addInvitation();
  }

  private createEmailGroup(): FormGroup {
    return this.fb.group({
      email: ['', [
        Validators.required,
        Validators.pattern(this.validationsService.emailPattern)
      ]]
    });
  }

  private setupEmailValidation(): void {
    this.invitations.controls.forEach(group => {
      const emailControl = group.get('email');
      console.log('emailControl:', emailControl);
      emailControl?.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(email => {
          if (!email) return false;
          return new RegExp(this.validationsService.emailPattern).test(email);
        }),
        switchMap(email => this.userService.checkUserEmail(email).pipe(
          take(1)
        )),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (response) => {
          this.verifiedEmails.add(response.email);
          this.showSuccessMessage(`Usuario encontrado: ${response.nombre} ${response.apellido}`);
          this.cdr.markForCheck();
        },
        error: (error) => {
          emailControl.setErrors({ notRegistered: true });
          this.showErrorMessage(error);
          this.cdr.markForCheck();
        }
      });
    });
  }

  protected get invitations(): FormArray {
    return this.invitationForm.get('invitations') as FormArray;
  }

  protected addInvitation(): void {
    if (this.invitations.length >= 5) {
      this.showErrorMessage('No puedes invitar a más de 5 colaboradores a la vez');
      return;
    }
    this.invitations.push(this.createEmailGroup());
    this.setupEmailValidation();
    this.cdr.markForCheck();
  }

  protected removeInvitation(index: number): void {
    const emailToRemove = this.invitations.at(index).get('email')?.value;
    this.verifiedEmails.delete(emailToRemove);
    this.invitations.removeAt(index);
    this.cdr.markForCheck();
  }

  protected async onSubmit(): Promise<void> {
    if (this.invitationForm.invalid) {
      this.invitationForm.markAllAsTouched();
      this.showErrorMessage('Por favor, revisa los campos del formulario');
      return;
    }

    const allEmailsVerified = this.invitations.controls.every(control =>
      this.verifiedEmails.has(control.get('email')?.value)
    );

    if (!allEmailsVerified) {
      this.showErrorMessage('Todos los emails deben ser verificados');
      return;
    }

    this.isProcessing = true;
    this.invitationForm.disable();
    this.cdr.markForCheck();

    try {
      const invitedEmails = this.invitations.controls
        .map(control => control.get('email')?.value)
        .filter(Boolean);

     // const currentContent = await this.collaborationService.getCurrentContent();
      const sessionId = await this.collaborationService.initializeCollaborativeSession(
        invitedEmails,
        this.invitationForm.value as InvitationPermissions
      );

      this.collaborationUrl = this.generateCollaborationUrl(sessionId);
      this.showUrlSection = true;
      this.showSuccessMessage('Sesión colaborativa iniciada exitosamente');
    } catch (error) {
      this.showErrorMessage('No se pudo iniciar la sesión colaborativa');
      this.invitationForm.enable();
    } finally {
      this.isProcessing = false;
      this.cdr.markForCheck();
    }
  }

  protected async copyUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.collaborationUrl);
      this.showSuccessMessage('URL copiada al portapapeles');
    } catch {
      this.showErrorMessage('No se pudo copiar la URL');
    }
  }

  protected close(): void {
    this.dialogRef.close(this.showUrlSection);

    if (this.showUrlSection) {
      window.history.pushState({}, '', this.collaborationUrl);
    }
  }

  protected getFieldError(groupIndex: number): string | null {
    const group = this.invitations.at(groupIndex) as FormGroup;
    const emailControl = group.get('email');

    if (emailControl?.errors?.['notRegistered']) {
      return 'El usuario no está registrado en el sistema';
    }

    return this.validationsService.getFieldError(group, 'email');
  }

  protected fieldHasErrors(groupIndex: number): boolean {
    return this.validationsService.fieldHasErros(
      this.invitations.at(groupIndex) as FormGroup,
      'email'
    );
  }

  private generateCollaborationUrl(sessionId: string): string {
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?sessionId=${sessionId}`;
  }

  private showSuccessMessage(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['success-snackbar']
    });
  }

  private showErrorMessage(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }
}
