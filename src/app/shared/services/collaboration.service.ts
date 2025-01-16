import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../auth/services/auth.service';
import { WebsocketService } from './websocket.service';
import { Observable, Subject, map, tap } from 'rxjs';
import { CollaborationUpdate, DiagramChange } from '../../core/interfaces/collaboration.interfaces';

@Injectable({
  providedIn: 'root'
})
export class CollaborationService {
  private authService = inject(AuthService);
  private websocketService = inject(WebsocketService);

  private creatorEmail: string | null = null;
  private sessionId: string | null = null;
  private isProcessingChanges = false;
  private currentDiagramData: any = null;

  async getCurrentDiagramData(): Promise<any> {
    console.log('[CollaborationService] Getting current diagram data:', this.currentDiagramData);
    return this.currentDiagramData;
  }

  setCurrentDiagramData(data: any): void {
    console.log('[CollaborationService] Setting current diagram data:', data);
    this.currentDiagramData = data;
  }

  async initializeCollaborativeSession(invitedUsers: string[], initialData: any): Promise<string> {
    console.log('[CollaborationService] Initializing collaborative session');
    console.log('[CollaborationService] Invited users:', invitedUsers);
    console.log('[CollaborationService] Initial data:', initialData);
    
    const currentUser = this.authService.currentUser();

    if (!currentUser) {
      console.error('[CollaborationService] No authenticated user found');
      throw new Error('No user authenticated');
    }

    try {
      // Guardar el contenido actual
      this.setCurrentDiagramData(initialData);

      // Crear sesión con contenido inicial
      const createResponse = await this.websocketService.createSession(
        currentUser.email,
        initialData
      );

      console.log('[CollaborationService] Create session response:', createResponse);

      this.sessionId = createResponse.sessionId;
      this.creatorEmail = currentUser.email;
      console.log('[CollaborationService] Session created:', this.sessionId);

      if (!this.sessionId) {
        throw new Error('No session ID received');
      }

      // Verificar que invitedUsers es un array y no está vacío
      if (!Array.isArray(invitedUsers) || invitedUsers.length === 0) {
        console.warn('[CollaborationService] No users to invite or invalid invitedUsers:', invitedUsers);
        return this.sessionId;
      }

      // Añadir usuarios permitidos
      const addUsersResponse = await this.websocketService.addAllowedUsers(
        this.sessionId,
        currentUser.email,
        invitedUsers
      );

      console.log('[CollaborationService] Add allowed users response:', addUsersResponse);
      console.log('[CollaborationService] Users added to session:', invitedUsers);

      return this.sessionId;
    } catch (error) {
      console.error('[CollaborationService] Error initializing session:', error);
      throw error;
    }
  }

  // async initializeCollaborativeSession(invitedUsers: string[], initialData: any): Promise<string> {
  //   console.log('[CollaborationService] Initializing collaborative session');
  //   const currentUser = this.authService.currentUser();

  //   if (!currentUser) {
  //     console.error('[CollaborationService] No authenticated user found');
  //     throw new Error('No user authenticated');
  //   }

  //   try {
  //     // Guardar el contenido actual
  //     this.setCurrentDiagramData(initialData);

  //     // Crear sesión con contenido inicial
  //     const createResponse = await this.websocketService.createSession(
  //       currentUser.email,
  //       initialData
  //     );

  //     this.sessionId = createResponse.sessionId;
  //     this.creatorEmail = currentUser.email;
  //     console.log('[CollaborationService] Session created:', this.sessionId);

  //     // Añadir usuarios permitidos
  //     await this.websocketService.addAllowedUsers(
  //       this.sessionId!,
  //       currentUser.email,
  //       invitedUsers
  //     );
  //     console.log('[CollaborationService] Users added to session:', invitedUsers);

  //     return this.sessionId!;
  //   } catch (error) {
  //     console.error('[CollaborationService] Error initializing session:', error);
  //     throw error;
  //   }
  // }

  async joinSession(sessionId: string): Promise<void> {
    console.log('[CollaborationService] Joining session:', sessionId);
    const currentUser = this.authService.currentUser();

    if (!currentUser) {
      console.error('[CollaborationService] No user authenticated');
      throw new Error('No user authenticated');
    }

    try {
      const response = await this.websocketService.joinSession(sessionId, currentUser.email);
      this.sessionId = sessionId;

      if (response.currentContent?.diagramData) {
        console.log('[CollaborationService] Received initial data:', response.currentContent.diagramData);
        this.setCurrentDiagramData(response.currentContent.diagramData);
      }

      if (response.isCreator) {
        this.creatorEmail = currentUser.email;
      }

      console.log('[CollaborationService] Join successful');
    } catch (error) {
      console.error('[CollaborationService] Join error:', error);
      throw error;
    }
  }

  getChanges(): Observable<DiagramChange> {
    console.log('[CollaborationService] Setting up changes observer');
    return this.websocketService.onDiagramChanges().pipe(
      map(change => {
        if (change.diagramData) {
          this.setCurrentDiagramData(change.diagramData);
        }
        return {
          delta: change.delta,
          diagramData: change.diagramData,
          userEmail: change.userEmail,
          timestamp: change.timestamp
        };
      })
    );
  }

  sendChanges(changes: { delta: any, diagramData: any }): void {
    console.log('[CollaborationService] Processing changes:', changes);

    if (!this.sessionId || this.isProcessingChanges) {
      console.warn('[CollaborationService] Cannot send changes - no session or processing');
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      console.error('[CollaborationService] No user authenticated');
      return;
    }

    try {
      this.isProcessingChanges = true;
      this.setCurrentDiagramData(changes.diagramData);

      this.websocketService.sendDiagramChanges(
        this.sessionId,
        currentUser.email,
        changes.delta,
        changes.diagramData
      );
      console.log('[CollaborationService] Change sent to WebSocket with full diagram data');

    } catch (error) {
      console.error('[CollaborationService] Error sending changes:', error);
    } finally {
      this.isProcessingChanges = false;
    }
  }

  getUserUpdates(): Observable<CollaborationUpdate> {
    console.log('[CollaborationService] Setting up user updates stream');
    return this.websocketService.onCollaborationUpdates().pipe(
      tap(update => console.log('[CollaborationService] Received collaboration update:', update))
    );
  }

  async updateUserPermissions(targetUserEmail: string, newPermissions: any): Promise<void> {
    console.log('[CollaborationService] Starting permission update for:', targetUserEmail);
    if (!this.sessionId || !this.authService.currentUser()) {
      throw new Error('No active session or user');
    }

    try {
      await this.websocketService.updatePermissions({
        sessionId: this.sessionId,
        targetUserEmail,
        newPermissions,
        requestedByEmail: this.authService.currentUser()!.email
      });
    } catch (error) {
      console.error('[CollaborationService] Error updating permissions:', error);
      throw new Error('Error al actualizar los permisos');
    }
  }

  disconnect(): void {
    console.log('[CollaborationService] Disconnecting from session');
    this.websocketService.disconnect();
    this.sessionId = null;
    this.currentDiagramData = null;
  }

  getCreatorEmail(): string | null {
    return this.creatorEmail;
  }
}
