import { Component, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../auth/services/auth.service';
import { CollaborationUser, PermissionKey, CollaborationUpdate, UserPermissions } from '../../../../core/interfaces';
import { CollaborationService } from '../../../../shared/services/collaboration.service';
import { MaterialModules } from '../../../../shared/material.module';
import { MatDrawer } from '@angular/material/sidenav';

@Component({
  selector: 'app-collaboration-panel',
  imports: [MaterialModules],
  templateUrl: './collaboration-panel.component.html',
  styleUrl: './collaboration-panel.component.scss'
})
export class CollaborationPanelComponent implements OnInit {
  @ViewChild('drawer') drawer!: MatDrawer;
  
  private collaborationService = inject(CollaborationService);
  private authService = inject(AuthService);

  users = signal<CollaborationUser[]>([]);
  currentUserEmail = signal<string>('');
  isCreator = signal<boolean>(false);

  permissions = [
    { key: 'canEdit' as PermissionKey, label: 'Editar diagrama' },
    { key: 'canInvite' as PermissionKey, label: 'Invitar usuarios' },
    { key: 'canChangePermissions' as PermissionKey, label: 'Gestionar permisos' }
  ];

  ngOnInit() {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.currentUserEmail.set(currentUser.email);
      this.isCreator.set(currentUser.email === this.collaborationService.getCreatorEmail());
    }

    this.setupCollaborationUpdates();
  }

  private setupCollaborationUpdates(): void {
    this.collaborationService.getUserUpdates().subscribe(update => {
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
    });
  }

  private handleUserJoined(data: any): void {
    const currentUsers = this.users();
    if (Array.isArray(data.activeUsers)) {
      const updatedUsers = data.activeUsers.map((email: string) => ({
        email,
        isActive: true,
        permissions: data.permissions || this.getDefaultPermissions(),
        lastActivity: Date.now(),
        isCreator: email === this.collaborationService.getCreatorEmail()
      }));
      this.users.set(updatedUsers);
    }
  }

  private handleUserLeft(data: any): void {
    const currentUsers = this.users();
    const updatedUsers = currentUsers.map(user => 
      user.email === data.userEmail ? { ...user, isActive: false } : user
    );
    this.users.set(updatedUsers);
  }

  private handlePermissionsChanged(data: any): void {
    const currentUsers = this.users();
    const updatedUsers = currentUsers.map(user =>
      user.email === data.userEmail ? { ...user, permissions: data.permissions } : user
    );
    this.users.set(updatedUsers);
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
    }
  }

  private getDefaultPermissions() {
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
}