import { execute, query } from '../config/db.js';
import { LeaveModel } from '../models/leave.model.js';
import { UserModel } from '../models/user.model.js';
import { AuditService } from '../security/audit.service.js';
import { UserProfile } from '../security/roleAccess.js';
import { NotificationService } from './notification.service.js';
import { addDays, isWorkingDay, sastToday } from './workdays.service.js';

// Leave-cover orchestration. The scheduler marks its own temporary-coordinator
// assignments with tempAssignedBy = 'leave-cover:<coordinator username>' so it
// never reverts an acting role that the Chief Director assigned manually.
export const LEAVE_COVER_PREFIX = 'leave-cover:';

interface OpenIncidentRow {
  id: string;
  refNo: string;
  responsiblePerson: string;
  province: string;
  status: string;
}

/**
 * Whether the substitution for a set of approved leave dates should be active
 * on `today`. True on an approved day itself; also true on a non-working day
 * that sits inside a gap of ONLY non-working days between two approved days
 * (so cover bridges a weekend between Friday and Monday without churning
 * incidents back and forth — but does hand back for a working Tuesday between
 * an approved Monday and Wednesday).
 */
export const substitutionActiveOn = (approvedDates: string[], today: string): boolean => {
  if (approvedDates.includes(today)) return true;
  if (isWorkingDay(today)) return false;

  const before = approvedDates.filter(d => d < today);
  const after = approvedDates.filter(d => d > today);
  if (before.length === 0 || after.length === 0) return false;

  const prev = before.reduce((a, b) => (a > b ? a : b));
  const next = after.reduce((a, b) => (a < b ? a : b));
  for (let d = addDays(prev, 1); d < next; d = addDays(d, 1)) {
    if (isWorkingDay(d)) return false;
  }
  return true;
};

const systemAudit = (action: 'UPDATE', resource: string, resourceId: string, details: string, province: string) =>
  AuditService.log({
    timestamp: new Date().toISOString(),
    userId: 'system',
    username: 'leave-scheduler',
    userRole: 'system',
    province,
    action,
    resource,
    resourceId,
    details
  });

const getOpenIncidentsFor = (displayName: string, province: string) =>
  query<OpenIncidentRow>(
    `SELECT id, refNo, responsiblePerson, province, status FROM incidents
     WHERE responsiblePerson = ? AND province = ? AND status <> 'Closed'`,
    [displayName, province]
  );

const formatDates = (dates: string[]) => dates.join(', ');

export const LeaveService = {
  /** Running balance: allocation minus every day still requested or granted. */
  async getBalance(username: string): Promise<{ total: number; committed: number; available: number }> {
    const user = await UserModel.getByUsername(username);
    const total = user?.totalLeaves ?? 0;
    const committed = await LeaveModel.countCommitted(username);
    return { total, committed, available: Math.max(0, total - committed) };
  },

  /**
   * Coordinators who can receive new incidents for a province right now:
   * permanent (and manually appointed acting) coordinators who are NOT on
   * approved leave today, i.e. an on-leave coordinator is replaced in the
   * auto-assignment pool by their acting substitute (FR-006).
   */
  async getEffectiveCoordinatorsForProvince(province: string): Promise<UserProfile[]> {
    const users = await UserModel.getAll();
    const coordinators = users.filter(u => u.role === 'security_coordinator' && u.province === province);
    const today = sastToday();

    const effective: UserProfile[] = [];
    for (const coordinator of coordinators) {
      if (coordinator.baseRole) {
        // acting coordinator (leave cover or manual appointment) — already effective
        effective.push(coordinator);
        continue;
      }
      const approvedToday = await LeaveModel.getApprovedOnDate(coordinator.username, today);
      if (approvedToday.length === 0) {
        effective.push(coordinator);
      }
      // On leave: skipped — their substitute appears in this list once promoted.
    }
    return effective;
  },

  /**
   * Daily sweep (00:05 SAST + server boot). Order matters: expire stale
   * requests first, then hand back finished covers, then activate today's.
   * Every step is idempotent so reboots and repeated runs are safe.
   */
  async runDailySweep(): Promise<void> {
    const today = sastToday();
    console.log(`[LeaveService] Running daily sweep for ${today} (SAST)`);
    try {
      await this.expireStalePending(today);
      await this.remindDirectorsOfPending(today);
      await this.revertFinishedSubstitutions(today);
      await this.activateDueSubstitutions(today);
    } catch (err) {
      console.error('[LeaveService] Daily sweep failed:', err);
    }
  },

  /** Pending days whose date arrived undecided expire and release the balance. */
  async expireStalePending(today: string): Promise<void> {
    const stale = await LeaveModel.getStalePending(today);
    const byBatch = new Map<string, typeof stale>();
    for (const day of stale) {
      const changed = await LeaveModel.transitionStatus(day.id, ['Pending'], 'Expired', {
        decidedBy: 'leave-scheduler',
        decidedAt: new Date().toISOString(),
        decisionNote: 'Expired automatically: the leave date arrived before a decision was made.'
      });
      if (!changed) continue;
      const group = byBatch.get(day.batchId) || [];
      group.push(day);
      byBatch.set(day.batchId, group);
      await systemAudit('UPDATE', 'Leave Request', day.id,
        `Leave day ${day.leaveDate} for ${day.ownerId} expired without a decision`, day.province);
    }

    const directors = (await UserModel.getAll()).filter(u => u.role === 'security_director');
    for (const [batchId, days] of byBatch) {
      const dates = formatDates(days.map(d => d.leaveDate));
      await NotificationService.notify(
        days[0].ownerId,
        'Leave request expired',
        `Your leave request for ${dates} expired because it was not decided before the leave date. The day(s) have been returned to your balance.`,
        '#/leaves'
      );
      await NotificationService.notifyMany(
        directors.map(d => d.username),
        'Leave request expired undecided',
        `The leave request from ${days[0].ownerDisplayName || days[0].ownerId} for ${dates} (ref ${batchId}) expired without a decision.`,
        '#/leave_management'
      );
    }
  },

  /** 24h-before nudge to the Chief Director for still-pending requests. */
  async remindDirectorsOfPending(today: string): Promise<void> {
    const tomorrow = addDays(today, 1);
    const pending = await LeaveModel.getPendingOnDate(tomorrow);
    if (pending.length === 0) return;

    const directors = (await UserModel.getAll()).filter(u => u.role === 'security_director');
    const seenBatches = new Set<string>();
    for (const day of pending) {
      if (seenBatches.has(day.batchId)) continue;
      seenBatches.add(day.batchId);

      for (const director of directors) {
        // Dedupe: boot-time sweeps must not resend the same day's reminder
        const existing = await query<{ id: string }>(
          `SELECT id FROM notifications WHERE username = ? AND message LIKE ? AND dateCreated >= ?`,
          [director.username, `%${day.batchId}%`, `${today}T00:00:00`]
        );
        if (existing.length > 0) continue;
        await NotificationService.notify(
          director.username,
          'Leave request starts tomorrow — decision needed',
          `The leave request from ${day.ownerDisplayName || day.ownerId} (ref ${day.batchId}) has its first day tomorrow (${day.leaveDate}) and is still awaiting your decision. Undecided days expire automatically.`,
          '#/leave_management'
        );
      }
    }
  },

  /** Promote today's substitutes and hand the coordinator's open incidents over. */
  async activateDueSubstitutions(today: string): Promise<void> {
    const pairs = await LeaveModel.getApprovedPairs();
    for (const pair of pairs) {
      const dates = await LeaveModel.getApprovedDatesForPair(pair.ownerId, pair.substituteUsername);
      if (!substitutionActiveOn(dates, today)) continue;

      const owner = await UserModel.getByUsername(pair.ownerId);
      const substitute = await UserModel.getByUsername(pair.substituteUsername);
      if (!owner || !substitute) continue;

      const coverTag = `${LEAVE_COVER_PREFIX}${owner.username}`;
      let promotedNow = false;

      if (substitute.role === 'employee' && !substitute.baseRole) {
        const promoted = await UserModel.assignTempCoordinator(substitute.username, coverTag);
        if (!promoted) {
          console.error(`[LeaveService] Failed to promote ${substitute.username} as leave cover for ${owner.username}`);
          continue;
        }
        promotedNow = true;
        await systemAudit('UPDATE', 'User Role', substitute.id,
          `Promoted ${substitute.displayName} to Temporary Security Coordinator (leave cover for ${owner.displayName}, ${owner.province})`,
          owner.province);
      } else if (substitute.tempAssignedBy !== coverTag) {
        // Substitute is unavailable (acting elsewhere, role changed since approval)
        const directors = (await UserModel.getAll()).filter(u => u.role === 'security_director');
        await NotificationService.notifyMany(
          directors.map(d => d.username),
          'Leave cover could not be activated',
          `${substitute.displayName} could not be promoted as acting coordinator for ${owner.displayName} (${owner.province}) — they are no longer an available employee. ${owner.province} may be without cover today.`,
          '#/leave_management'
        );
        continue;
      }

      // Hand over open incidents not already transferred (idempotent per incident)
      const activeTransfers = await LeaveModel.getActiveTransfers(owner.username, substitute.username);
      const alreadyTransferred = new Set(activeTransfers.map(t => t.incidentId));
      const openIncidents = await getOpenIncidentsFor(owner.displayName, owner.province);
      let transferred = 0;
      for (const incident of openIncidents) {
        if (alreadyTransferred.has(incident.id)) continue;
        await execute(`UPDATE incidents SET responsiblePerson = ? WHERE id = ?`, [substitute.displayName, incident.id]);
        await LeaveModel.insertTransfer({
          id: `lvt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          batchId: pair.batchId,
          incidentId: incident.id,
          fromUser: owner.username,
          toUser: substitute.username,
          transferredAt: new Date().toISOString()
        });
        transferred++;
        await systemAudit('UPDATE', 'Incident', incident.id,
          `Transferred ${incident.refNo} from ${owner.displayName} to acting coordinator ${substitute.displayName} (leave cover)`,
          owner.province);
      }

      if (promotedNow) {
        const first = dates.reduce((a, b) => (a < b ? a : b));
        const last = dates.reduce((a, b) => (a > b ? a : b));
        await NotificationService.notify(
          substitute.username,
          'You are acting Security Coordinator',
          `You have been appointed acting Security Coordinator for ${owner.province} while ${owner.displayName} is on approved leave (${first} to ${last}). ${transferred} open case(s) have been transferred to you; new incidents for ${owner.province} will be routed to you until they return.`,
          '#/my_cases'
        );
        await NotificationService.notify(
          owner.username,
          'Leave cover active',
          `Your approved leave has started. ${substitute.displayName} is acting Security Coordinator for ${owner.province} and your ${transferred} open case(s) have been transferred to them for the duration of your leave.`,
          '#/leaves'
        );
      }
    }
  },

  /** Return incidents and revert acting roles once the cover window has passed. */
  async revertFinishedSubstitutions(today: string): Promise<void> {
    const covers = await query<{ username: string; tempAssignedBy: string }>(
      `SELECT username, tempAssignedBy FROM users
       WHERE baseRole IS NOT NULL AND tempAssignedBy LIKE ?`,
      [`${LEAVE_COVER_PREFIX}%`]
    );

    for (const cover of covers) {
      const ownerUsername = cover.tempAssignedBy.slice(LEAVE_COVER_PREFIX.length);
      const dates = await LeaveModel.getApprovedDatesForPair(ownerUsername, cover.username);
      if (substitutionActiveOn(dates, today)) continue;

      const owner = await UserModel.getByUsername(ownerUsername);
      const substitute = await UserModel.getByUsername(cover.username);
      if (!owner || !substitute) continue;

      // Everything open on the substitute's desk for this province goes (back) to
      // the returning coordinator — including incidents auto-assigned during leave.
      const openIncidents = await getOpenIncidentsFor(substitute.displayName, owner.province);
      for (const incident of openIncidents) {
        await execute(`UPDATE incidents SET responsiblePerson = ? WHERE id = ?`, [owner.displayName, incident.id]);
        await systemAudit('UPDATE', 'Incident', incident.id,
          `Returned ${incident.refNo} from acting coordinator ${substitute.displayName} to ${owner.displayName} (leave ended)`,
          owner.province);
      }
      await LeaveModel.markTransfersRestored(owner.username, substitute.username);

      const reverted = await UserModel.revokeTempCoordinator(substitute.username);
      if (reverted) {
        await systemAudit('UPDATE', 'User Role', substitute.id,
          `Reverted ${substitute.displayName} from Temporary Security Coordinator to their permanent role (leave cover for ${owner.displayName} ended)`,
          owner.province);
        await NotificationService.notify(
          substitute.username,
          'Acting coordinator assignment ended',
          `${owner.displayName} has returned from leave. Your acting Security Coordinator assignment for ${owner.province} has ended and ${openIncidents.length} open case(s) were returned to them. Thank you for covering.`,
          '#/dashboard'
        );
        await NotificationService.notify(
          owner.username,
          'Welcome back — cases returned',
          `Welcome back from leave. ${openIncidents.length} open case(s) have been returned to you from ${substitute.displayName}, and new incidents for ${owner.province} route to you again.`,
          '#/my_cases'
        );
      }
    }
  }
};
