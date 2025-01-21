export type PermissionKey = 'canEdit' | 'canInvite' | 'canManagePermissions';

export interface UserPermissions {
    canEdit: boolean;
    canInvite: boolean;
    canManagePermissions: boolean;
}


export interface CollaborationUser {
    email: string;
    displayName?: string;
    isActive: boolean;
    permissions: UserPermissions;
    lastActivity: number;
    isCreator: boolean;
}

export interface CollaborationUpdate {
    type: 'USER_JOINED' | 'USER_LEFT' | 'PERMISSIONS_CHANGED';
    sessionId: string;
    data: {
        userEmail: string;
        permissions?: UserPermissions;
        activeUsers?: string[];
        isCreator?: boolean;
    };
    timestamp: number;
}

export interface DiagramChange {
    delta: any;
    diagramData: any;
    userEmail: string;
    timestamp: number;
}
