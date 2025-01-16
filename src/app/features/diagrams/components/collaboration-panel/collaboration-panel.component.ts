import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../auth/services/auth.service';
import { CollaborationUser, PermissionKey, CollaborationUpdate, UserPermissions } from '../../../../core/interfaces';
import { CollaborationService } from '../../../../shared/services/collaboration.service';
import { MaterialModules } from '../../../../shared/material.module';

@Component({
  selector: 'app-collaboration-panel',
  imports: [MaterialModules],
  templateUrl: './collaboration-panel.component.html',
  styleUrl: './collaboration-panel.component.scss'
})
export class CollaborationPanelComponent implements OnInit, OnDestroy {
  private collaborationService = inject(CollaborationService);
  private authService = inject(AuthService);

  drawer!: any; // Referencia al mat-drawer
  users = signal<CollaborationUser[]>([]);
  currentUserEmail = signal<string>('');
  canManagePermissions = signal<boolean>(false);

  permissions: { key: PermissionKey; label: string }[] = [
    { key: 'canEdit', label: 'Permitir edición' },
    { key: 'canInvite', label: 'Permitir invitar' },
    { key: 'canChangePermissions', label: 'Permitir gestionar permisos' },
    { key: 'canRemoveUsers', label: 'Permitir eliminar usuarios' }
  ];

  private subscriptions: Subscription[] = [];

  ngOnInit() {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.currentUserEmail.set(currentUser.email);
    }

    this.subscriptions.push(
      this.collaborationService.getUserUpdates().subscribe(update => {
        this.handleUserUpdate(update);
      })
    );
  }

  private handleUserUpdate(update: CollaborationUpdate): void {
    const currentUsers = this.users();

    switch (update.type) {
      case 'USER_JOINED': {
        const { userEmail, permissions, activeUsers, isCreator } = update.data;
        if (Array.isArray(activeUsers)) {
          const updatedUsers: CollaborationUser[] = activeUsers.map(email => ({
            email,
            isActive: true,
            permissions: email === userEmail ?
              permissions || this.getDefaultPermissions() : // Si no hay permisos, usar default
              this.getDefaultPermissions(),
            lastActivity: Date.now(),
            isCreator: email === this.collaborationService.getCreatorEmail()
          }));
          this.users.set(updatedUsers);
        }
        break;
      }

      case 'USER_LEFT': {
        const { userEmail } = update.data;
        const updatedUsers = currentUsers.map(user =>
          user.email === userEmail ? { ...user, isActive: false } : user
        );
        this.users.set(updatedUsers);
        break;
      }

      case 'PERMISSIONS_CHANGED': {
        const { userEmail, permissions } = update.data;
        const updatedUsers = currentUsers.map(user =>
          user.email === userEmail ?
            { ...user, permissions: permissions || this.getDefaultPermissions() } :
            user
        );
        this.users.set(updatedUsers);
        break;
      }
    }
  }

  async onPermissionChange(permission: PermissionKey, user: CollaborationUser): Promise<void> {
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
      user.permissions[permission] = !user.permissions[permission]; // Revertir cambio
    }
  }

  private getDefaultPermissions(): UserPermissions {
    return {
      canEdit: true,
      canInvite: false,
      canChangePermissions: false,
      canRemoveUsers: false
    };
  }

  toggle(): void {
    if (this.drawer) {
      this.drawer.toggle();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}