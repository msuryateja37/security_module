// Leave management domain types — mirror server/models/leave.model.ts

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Revoked' | 'Cancelled' | 'Expired';

export interface LeaveDay {
  id: string;
  batchId: string;
  ownerId: string;
  province: string;
  leaveDate: string; // 'YYYY-MM-DD'
  reason: string | null;
  status: LeaveStatus;
  substituteUsername: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  dateCreated: string;
  ownerDisplayName?: string;
  substituteDisplayName?: string;
}

export interface LeaveBalance {
  total: number;
  committed: number;
  available: number;
}

export interface SubstituteCandidate {
  username: string;
  displayName: string;
  office: string;
  conflictDates: string[];
}

export interface AppNotification {
  id: string;
  username: string;
  title: string;
  message: string;
  link: string | null;
  isRead: number | boolean;
  dateCreated: string;
}

/** Approved → green, Pending → amber, Rejected → red — the app's badge palette. */
export const LEAVE_STATUS_BADGE: Record<LeaveStatus, string> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  Revoked: 'danger',
  Cancelled: 'muted',
  Expired: 'muted'
};
