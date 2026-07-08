import { execute, query, queryOne } from '../config/db.js';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Revoked' | 'Cancelled' | 'Expired';

export interface LeaveDayRow {
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
  // joined display fields (SELECTs below)
  ownerDisplayName?: string;
  substituteDisplayName?: string;
}

export interface LeaveTransferRow {
  id: string;
  batchId: string;
  incidentId: string;
  fromUser: string;
  toUser: string;
  transferredAt: string;
  restoredAt: string | null;
}

const DAY_SELECT = `
  SELECT ld.*, ou.displayName AS ownerDisplayName, su.displayName AS substituteDisplayName
  FROM leave_days ld
  LEFT JOIN users ou ON ou.username = ld.ownerId
  LEFT JOIN users su ON su.username = ld.substituteUsername
`;

export const LeaveModel = {
  async getByOwner(username: string): Promise<LeaveDayRow[]> {
    return query<LeaveDayRow>(`${DAY_SELECT} WHERE ld.ownerId = ? ORDER BY ld.leaveDate`, [username]);
  },

  async getAll(): Promise<LeaveDayRow[]> {
    return query<LeaveDayRow>(`${DAY_SELECT} ORDER BY ld.dateCreated DESC, ld.leaveDate`);
  },

  async getByBatch(batchId: string): Promise<LeaveDayRow[]> {
    return query<LeaveDayRow>(`${DAY_SELECT} WHERE ld.batchId = ? ORDER BY ld.leaveDate`, [batchId]);
  },

  async getById(id: string): Promise<LeaveDayRow | null> {
    return queryOne<LeaveDayRow>(`${DAY_SELECT} WHERE ld.id = ?`, [id]);
  },

  async insertDay(row: Omit<LeaveDayRow, 'ownerDisplayName' | 'substituteDisplayName'>): Promise<void> {
    await execute(
      `INSERT INTO leave_days (id, batchId, ownerId, province, leaveDate, reason, status, substituteUsername, decidedBy, decidedAt, decisionNote, dateCreated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.batchId, row.ownerId, row.province, row.leaveDate, row.reason, row.status,
       row.substituteUsername, row.decidedBy, row.decidedAt, row.decisionNote, row.dateCreated]
    );
  },

  /** Days currently holding the owner's balance (requested or granted). */
  async countCommitted(username: string): Promise<number> {
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM leave_days WHERE ownerId = ? AND status IN ('Pending', 'Approved')`,
      [username]
    );
    return row?.n ?? 0;
  },

  /** The owner's dates that would clash with a new request. */
  async getCommittedDates(username: string): Promise<string[]> {
    const rows = await query<{ leaveDate: string }>(
      `SELECT leaveDate FROM leave_days WHERE ownerId = ? AND status IN ('Pending', 'Approved')`,
      [username]
    );
    return rows.map(r => r.leaveDate);
  },

  /**
   * Guarded status transition — the WHERE clause re-checks the expected current
   * status so concurrent decisions can't double-apply (changes = 0 means lost race).
   */
  async transitionStatus(
    id: string,
    fromStatuses: LeaveStatus[],
    to: LeaveStatus,
    fields: { substituteUsername?: string | null; decidedBy?: string; decidedAt?: string; decisionNote?: string | null } = {}
  ): Promise<boolean> {
    const placeholders = fromStatuses.map(() => '?').join(', ');
    const result = await execute(
      `UPDATE leave_days
       SET status = ?,
           substituteUsername = COALESCE(?, substituteUsername),
           decidedBy = COALESCE(?, decidedBy),
           decidedAt = COALESCE(?, decidedAt),
           decisionNote = COALESCE(?, decisionNote)
       WHERE id = ? AND status IN (${placeholders})`,
      [to, fields.substituteUsername ?? null, fields.decidedBy ?? null, fields.decidedAt ?? null,
       fields.decisionNote ?? null, id, ...fromStatuses]
    );
    return result.changes > 0;
  },

  /** All Approved days for a coordinator+substitute pairing (drives activation/bridging). */
  async getApprovedDatesForPair(ownerId: string, substituteUsername: string): Promise<string[]> {
    const rows = await query<{ leaveDate: string }>(
      `SELECT leaveDate FROM leave_days WHERE ownerId = ? AND substituteUsername = ? AND status = 'Approved' ORDER BY leaveDate`,
      [ownerId, substituteUsername]
    );
    return rows.map(r => r.leaveDate);
  },

  /** Distinct coordinator/substitute pairings with any approved day (scheduler work-list). */
  async getApprovedPairs(): Promise<{ ownerId: string; substituteUsername: string; batchId: string }[]> {
    return query(
      `SELECT DISTINCT ownerId, substituteUsername, batchId FROM leave_days
       WHERE status = 'Approved' AND substituteUsername IS NOT NULL`
    );
  },

  /** Approved days on a specific date for a coordinator (any substitute). */
  async getApprovedOnDate(ownerId: string, date: string): Promise<LeaveDayRow[]> {
    return query<LeaveDayRow>(
      `${DAY_SELECT} WHERE ld.ownerId = ? AND ld.leaveDate = ? AND ld.status = 'Approved'`,
      [ownerId, date]
    );
  },

  /** Substitute double-booking check: approved days where this user already covers someone on these dates. */
  async getSubstituteConflicts(substituteUsername: string, dates: string[], excludeOwner: string): Promise<LeaveDayRow[]> {
    if (dates.length === 0) return [];
    const placeholders = dates.map(() => '?').join(', ');
    return query<LeaveDayRow>(
      `${DAY_SELECT} WHERE ld.substituteUsername = ? AND ld.status = 'Approved' AND ld.ownerId <> ? AND ld.leaveDate IN (${placeholders})`,
      [substituteUsername, excludeOwner, ...dates]
    );
  },

  /** Pending days whose date has arrived without a decision — swept to Expired. */
  async getStalePending(today: string): Promise<LeaveDayRow[]> {
    return query<LeaveDayRow>(
      `${DAY_SELECT} WHERE ld.status = 'Pending' AND ld.leaveDate <= ?`,
      [today]
    );
  },

  /** Pending days starting tomorrow — reminder trigger for the Chief Director. */
  async getPendingOnDate(date: string): Promise<LeaveDayRow[]> {
    return query<LeaveDayRow>(
      `${DAY_SELECT} WHERE ld.status = 'Pending' AND ld.leaveDate = ?`,
      [date]
    );
  },

  // ---- leave_transfers ----

  async insertTransfer(row: Omit<LeaveTransferRow, 'restoredAt'>): Promise<void> {
    await execute(
      `INSERT INTO leave_transfers (id, batchId, incidentId, fromUser, toUser, transferredAt, restoredAt)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [row.id, row.batchId, row.incidentId, row.fromUser, row.toUser, row.transferredAt]
    );
  },

  async getActiveTransfers(fromUser: string, toUser: string): Promise<LeaveTransferRow[]> {
    return query<LeaveTransferRow>(
      `SELECT * FROM leave_transfers WHERE fromUser = ? AND toUser = ? AND restoredAt IS NULL`,
      [fromUser, toUser]
    );
  },

  async markTransfersRestored(fromUser: string, toUser: string): Promise<void> {
    await execute(
      `UPDATE leave_transfers SET restoredAt = ? WHERE fromUser = ? AND toUser = ? AND restoredAt IS NULL`,
      [new Date().toISOString(), fromUser, toUser]
    );
  }
};
