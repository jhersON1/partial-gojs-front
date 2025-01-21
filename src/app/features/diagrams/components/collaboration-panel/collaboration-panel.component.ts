import { Component, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../auth/services/auth.service';
import { CollaborationUser, PermissionKey, CollaborationUpdate, UserPermissions } from '../../../../core/interfaces';
import { CollaborationService } from '../../../../shared/services/collaboration.service';
import { MaterialModules } from '../../../../shared/material.module';
import { MatDrawer } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-collaboration-panel',
  imports: [MaterialModules, CommonModule],
  templateUrl: './collaboration-panel.component.html',
  styleUrl: './collaboration-panel.component.scss'
})
export class CollaborationPanelComponent implements OnInit {
  @ViewChild('drawer') drawer!: MatDrawer;
  
  private collaborationService = inject(CollaborationService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  users = signal<CollaborationUser[]>([]);
  currentUserEmail = signal<string>('');
  isCreator = signal<boolean>(false);

  permissions = [
    { key: 'canEdit' as PermissionKey, label: 'Editar diagrama' },
    { key: 'canInvite' as PermissionKey, label: 'Invitar usuarios' },
    { key: 'canManagePermissions' as PermissionKey, label: 'Gestionar permisos' }
  ];

  ngOnInit() {
    console.log('CollaborationPanelComponent initializing...');
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      console.log('Current user:', currentUser.email);
      this.currentUserEmail.set(currentUser.email);
      const creatorEmail = this.collaborationService.getCreatorEmail();
      console.log('Creator email:', creatorEmail);
      this.isCreator.set(currentUser.email === creatorEmail);
    }

    this.setupCollaborationUpdates();
  }

  private setupCollaborationUpdates(): void {
    console.log('Setting up collaboration updates...');
    this.collaborationService.getUserUpdates().subscribe({
      next: (update) => {
        console.log('Received update:', update);
        switch (update.type) {
          case 'USER_JOINED':
            this.handleUserJoined(update.data);
            break;
          case 'USER_LEFT':
            this.handleUserLeft(update.data);
            break;
          case 'PERMISSIONS_CHANGED':
            this.handlePermissionsChanged(update.data);
            break;
        }
      },
      error: (error) => console.error('Error in collaboration updates:', error)
    });
  }

  private handleUserJoined(data: any): void {
    console.log('Handling user joined:', data);
    const updatedUsers = data.activeUsers?.map((email: string) => ({
      email,
      isActive: true,
      permissions: data.permissions || this.getDefaultPermissions(),
      lastActivity: Date.now(),
      isCreator: email === this.collaborationService.getCreatorEmail()
    })) || [];
    console.log('Updated users list:', updatedUsers);
    this.users.set(updatedUsers);
  }

  private handleUserLeft(data: any): void {
    console.log('Handling user left:', data);
    const updatedUsers = this.users().map(user => 
      user.email === data.userEmail ? { ...user, isActive: false } : user
    );
    this.users.set(updatedUsers);
  }

  private handlePermissionsChanged(data: any): void {
    console.log('Handling permissions changed:', data);
    const updatedUsers = this.users().map(user =>
      user.email === data.userEmail ? { ...user, permissions: data.permissions } : user
    );
    this.users.set(updatedUsers);
    
    if (data.userEmail === this.currentUserEmail()) {
      this.showPermissionUpdateNotification(data.permissions);
    }
  }

  private showPermissionUpdateNotification(permissions: any): void {
    this.snackBar.open('Tus permisos han sido actualizados', 'Cerrar', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  async onPermissionChange(permission: PermissionKey, user: CollaborationUser): Promise<void> {
    console.log('Permission change requested:', { permission, user });
    if (!this.isCreator()) {
      console.log('Not authorized to change permissions');
      return;
    }

    try {
      const newPermissions = {
        ...user.permissions,
        [permission]: !user.permissions[permission]
      };

      await this.collaborationService.updateUserPermissions(
        user.email,
        newPermissions
      );
    } catch (error) {
      console.error('Error updating permissions:', error);
      this.snackBar.open('Error al actualizar los permisos', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }

  private getDefaultPermissions() {
    return {
      canEdit: true,
      canInvite: false,
      canManagePermissions: false
    };
  }

  toggle(): void {
    if (this.drawer) {
      console.log('Toggling drawer');
      this.drawer.toggle();
    } else {
      console.error('Drawer not initialized');
    }
  }
}