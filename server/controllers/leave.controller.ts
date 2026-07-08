import { Response } from 'express';
import { LeaveDayRow, LeaveModel } from '../models/leave.model.js';
import { UserModel } from '../models/user.model.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { AuditService } from '../security/audit.service.js';
import { ResponseView } from '../views/response.view.js';
import { LeaveService } from '../services/leave.service.js';
import { NotificationService } from '../services/notification.service.js';
import { addDays, isPublicHoliday, isWeekend, sastToday } from '../services/workdays.service.js';
import { execute } from '../config/db.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REASON_LENGTH = 500;

// POPIA note: the reason field is personal data. Leave endpoints are only
// reachable by the owner (leave:request scoped to own rows) and the Chief
// Director (leave:review), and the reason is never written to the audit
// trail or into notification emails.

/** Once any approved day of a batch has started (SAST), the batch is locked. */
const batchLockDate = (batchDays: LeaveDayRow[]): string | null => {
  const approvedDates = batchDays.filter(d => d.status === 'Approved').map(d => d.leaveDate);
  if (approvedDates.length === 0) return null;
  return approvedDates.reduce((a, b) => (a < b ? a : b));
};

const getDirectors = async () =>
  (await UserModel.getAll()).filter(u => u.role === 'security_director');

export const LeaveController = {
  /** Coordinator: own leave days + running balance. */
  async mine(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const days = await LeaveModel.getByOwner(user.username);
      const balance = await LeaveService.getBalance(user.username);
      ResponseView.sendSuccess(res, { days, balance, today: sastToday() }, 'Fetched leave records successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch leave records');
    }
  },

  /** Coordinator submits a batch of leave days. */
  async request(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const reason = String(req.body?.reason || '').trim();
      const rawDates: unknown = req.body?.dates;

      if (!Array.isArray(rawDates) || rawDates.length === 0) {
        return ResponseView.sendError(res, 'Select at least one leave day', 'Validation failed', 400);
      }
      if (reason.length > MAX_REASON_LENGTH) {
        return ResponseView.sendError(res, `Reason must be ${MAX_REASON_LENGTH} characters or fewer`, 'Validation failed', 400);
      }

      const dates = [...new Set(rawDates.map(d => String(d)))].sort();
      const today = sastToday();
      const tomorrow = addDays(today, 1);

      for (const date of dates) {
        if (!DATE_RE.test(date)) {
          return ResponseView.sendError(res, `Invalid date: ${date}`, 'Validation failed', 400);
        }
        if (date < tomorrow) {
          return ResponseView.sendError(res, 'Leave can only be requested from tomorrow onwards — past dates and today are not allowed', 'Validation failed', 400);
        }
        if (isWeekend(date) || isPublicHoliday(date)) {
          return ResponseView.sendError(res, `${date} is not a working day — weekends and public holidays do not require leave`, 'Validation failed', 400);
        }
      }

      const committedDates = await LeaveModel.getCommittedDates(user.username);
      const clash = dates.find(d => committedDates.includes(d));
      if (clash) {
        return ResponseView.sendError(res, `You already have a pending or approved leave day on ${clash}`, 'Validation failed', 400);
      }

      const balance = await LeaveService.getBalance(user.username);
      if (dates.length > balance.available) {
        return ResponseView.sendError(
          res,
          `Insufficient leave balance: ${dates.length} day(s) requested but only ${balance.available} available`,
          'Validation failed',
          400
        );
      }

      const now = new Date().toISOString();
      const batchId = `lvb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      for (const date of dates) {
        await LeaveModel.insertDay({
          id: `lvd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          batchId,
          ownerId: user.username,
          province: user.province,
          leaveDate: date,
          reason: reason || null,
          status: 'Pending',
          substituteUsername: null,
          decidedBy: null,
          decidedAt: null,
          decisionNote: null,
          dateCreated: now
        });
      }

      // Concurrency guard: if a parallel request slipped past the balance check,
      // the recount exposes it — withdraw this batch rather than over-commit.
      const recount = await LeaveModel.countCommitted(user.username);
      if (recount > balance.total) {
        await execute('DELETE FROM leave_days WHERE batchId = ?', [batchId]);
        return ResponseView.sendError(res, 'Leave balance changed while submitting — please try again', 'Conflict', 409);
      }

      await AuditService.log({
        timestamp: now,
        userId: user.id,
        username: user.username,
        userRole: user.role,
        province: user.province,
        action: 'CREATE',
        resource: 'Leave Request',
        resourceId: batchId,
        details: `Requested ${dates.length} leave day(s): ${dates.join(', ')}`,
        clearanceLevel: user.clearanceLevel
      });

      const directors = await getDirectors();
      await NotificationService.notifyMany(
        directors.map(d => d.username),
        'New leave request',
        `${user.displayName} (${user.province}) requested ${dates.length} leave day(s): ${dates.join(', ')}. Please review and nominate an acting coordinator when approving.`,
        '#/leave_management'
      );

      const days = await LeaveModel.getByBatch(batchId);
      ResponseView.sendSuccess(res, { batchId, days }, 'Leave request submitted', 201);
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to submit leave request');
    }
  },

  /** Chief Director: every coordinator's leave days. */
  async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const days = await LeaveModel.getAll();
      ResponseView.sendSuccess(res, { days, today: sastToday() }, 'Fetched leave requests successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch leave requests');
    }
  },

  /** Eligible acting coordinators (same-province employees) for a batch. */
  async substitutes(req: AuthenticatedRequest, res: Response) {
    try {
      const batchId = String(req.params.batchId || '');
      const batchDays = await LeaveModel.getByBatch(batchId);
      if (batchDays.length === 0) {
        return ResponseView.sendError(res, 'Leave request not found', 'Operation failed', 404);
      }

      const pendingDates = batchDays.filter(d => d.status === 'Pending').map(d => d.leaveDate);
      const users = await UserModel.getAll();
      const candidates = users.filter(
        u => u.role === 'employee' && !u.baseRole && u.province === batchDays[0].province && u.username !== batchDays[0].ownerId
      );

      const result = [];
      for (const candidate of candidates) {
        const conflicts = await LeaveModel.getSubstituteConflicts(candidate.username, pendingDates, batchDays[0].ownerId);
        result.push({
          username: candidate.username,
          displayName: candidate.displayName,
          office: candidate.office,
          conflictDates: conflicts.map(c => c.leaveDate)
        });
      }
      ResponseView.sendSuccess(res, result, 'Fetched eligible substitutes successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch eligible substitutes');
    }
  },

  /**
   * Chief Director decides a batch: per-day approve/reject in one call
   * (e.g. approve 3 of 4 days). Any approval requires nominating a
   * same-province employee as acting coordinator.
   */
  async decide(req: AuthenticatedRequest, res: Response) {
    try {
      const director = req.user!;
      const batchId = String(req.params.batchId || '');
      const note = String(req.body?.note || '').trim() || null;
      const substituteUsername = String(req.body?.substituteUsername || '').trim().toLowerCase();
      const decisions: { dayId: string; action: string }[] = Array.isArray(req.body?.decisions) ? req.body.decisions : [];

      const batchDays = await LeaveModel.getByBatch(batchId);
      if (batchDays.length === 0) {
        return ResponseView.sendError(res, 'Leave request not found', 'Operation failed', 404);
      }

      const pendingDays = batchDays.filter(d => d.status === 'Pending');
      if (pendingDays.length === 0) {
        return ResponseView.sendError(res, 'This leave request has already been decided', 'Validation failed', 400);
      }

      const byId = new Map(pendingDays.map(d => [d.id, d]));
      if (decisions.length !== pendingDays.length || !decisions.every(d => byId.has(d.dayId))) {
        return ResponseView.sendError(res, 'A decision (approve or reject) is required for every pending day of this request', 'Validation failed', 400);
      }
      if (!decisions.every(d => d.action === 'approve' || d.action === 'reject')) {
        return ResponseView.sendError(res, "Each decision must be either 'approve' or 'reject'", 'Validation failed', 400);
      }

      const approvals = decisions.filter(d => d.action === 'approve').map(d => byId.get(d.dayId)!);
      const rejections = decisions.filter(d => d.action === 'reject').map(d => byId.get(d.dayId)!);

      const today = sastToday();
      const lateApproval = approvals.find(d => d.leaveDate <= today);
      if (lateApproval) {
        return ResponseView.sendError(
          res,
          `The day ${lateApproval.leaveDate} can no longer be approved — the leave date has already arrived. It will expire automatically.`,
          'Validation failed',
          400
        );
      }

      const owner = await UserModel.getByUsername(batchDays[0].ownerId);
      if (!owner) {
        return ResponseView.sendError(res, 'Requesting coordinator no longer exists', 'Operation failed', 404);
      }

      // Approvals require a nominated acting coordinator — server-verified, never
      // trusted from the client (provincial segregation, FR-033).
      let substitute = null;
      if (approvals.length > 0) {
        if (!substituteUsername) {
          return ResponseView.sendError(res, 'Nominate an employee to act as Security Coordinator before approving leave', 'Validation failed', 400);
        }
        substitute = await UserModel.getByUsername(substituteUsername);
        if (!substitute) {
          return ResponseView.sendError(res, 'Nominated substitute not found', 'Validation failed', 400);
        }
        if (substitute.role !== 'employee' || substitute.baseRole) {
          return ResponseView.sendError(res, 'The nominated substitute must be an Employee without an existing acting assignment', 'Validation failed', 400);
        }
        if (substitute.province !== owner.province) {
          return ResponseView.sendError(res, `The nominated substitute must belong to ${owner.province} (provincial data segregation)`, 'Validation failed', 400);
        }
        const approvedDates = approvals.map(d => d.leaveDate);
        const conflicts = await LeaveModel.getSubstituteConflicts(substitute.username, approvedDates, owner.username);
        if (conflicts.length > 0) {
          return ResponseView.sendError(
            res,
            `${substitute.displayName} is already nominated as acting coordinator on ${conflicts.map(c => c.leaveDate).join(', ')}`,
            'Validation failed',
            400
          );
        }
      }

      const now = new Date().toISOString();
      for (const day of approvals) {
        await LeaveModel.transitionStatus(day.id, ['Pending'], 'Approved', {
          substituteUsername: substitute!.username,
          decidedBy: director.username,
          decidedAt: now,
          decisionNote: note
        });
      }
      for (const day of rejections) {
        await LeaveModel.transitionStatus(day.id, ['Pending'], 'Rejected', {
          decidedBy: director.username,
          decidedAt: now,
          decisionNote: note
        });
      }

      await AuditService.log({
        timestamp: now,
        userId: director.id,
        username: director.username,
        userRole: director.role,
        province: director.province,
        action: 'UPDATE',
        resource: 'Leave Request',
        resourceId: batchId,
        details: `Decided leave request of ${owner.displayName}: approved [${approvals.map(d => d.leaveDate).join(', ') || 'none'}], rejected [${rejections.map(d => d.leaveDate).join(', ') || 'none'}]${substitute ? `; acting coordinator: ${substitute.displayName}` : ''}`,
        clearanceLevel: director.clearanceLevel
      });

      const summaryParts = [];
      if (approvals.length > 0) summaryParts.push(`APPROVED: ${approvals.map(d => d.leaveDate).join(', ')}`);
      if (rejections.length > 0) summaryParts.push(`REJECTED: ${rejections.map(d => d.leaveDate).join(', ')}`);
      await NotificationService.notify(
        owner.username,
        'Your leave request has been decided',
        `${director.displayName} decided your leave request. ${summaryParts.join(' | ')}.${substitute ? ` ${substitute.displayName} will act as Security Coordinator on your approved days.` : ''}${note ? ` Note: ${note}` : ''}`,
        '#/leaves'
      );
      if (substitute) {
        const approvedDates = approvals.map(d => d.leaveDate).join(', ');
        await NotificationService.notify(
          substitute.username,
          'You have been nominated as acting Security Coordinator',
          `${director.displayName} nominated you to act as Security Coordinator for ${owner.province} while ${owner.displayName} is on leave (${approvedDates}). The assignment activates automatically on each leave day.`,
          '#/dashboard'
        );
      }

      const days = await LeaveModel.getByBatch(batchId);
      ResponseView.sendSuccess(res, { batchId, days }, 'Leave request decided successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to decide leave request');
    }
  },

  /**
   * Chief Director revokes an approved day — only while the batch has not
   * started (once the first approved day arrives, the batch is locked).
   */
  async revoke(req: AuthenticatedRequest, res: Response) {
    try {
      const director = req.user!;
      const dayId = String(req.params.dayId || '');
      const note = String(req.body?.note || '').trim() || null;

      const day = await LeaveModel.getById(dayId);
      if (!day) {
        return ResponseView.sendError(res, 'Leave day not found', 'Operation failed', 404);
      }
      if (day.status !== 'Approved') {
        return ResponseView.sendError(res, 'Only approved leave days can be revoked', 'Validation failed', 400);
      }

      const batchDays = await LeaveModel.getByBatch(day.batchId);
      const lockDate = batchLockDate(batchDays);
      const today = sastToday();
      if (lockDate && today >= lockDate) {
        return ResponseView.sendError(
          res,
          `This leave has already started (first approved day: ${lockDate}) and can no longer be revoked`,
          'Validation failed',
          400
        );
      }

      const changed = await LeaveModel.transitionStatus(dayId, ['Approved'], 'Revoked', {
        decidedBy: director.username,
        decidedAt: new Date().toISOString(),
        decisionNote: note || 'Approval revoked by the Chief Director before the leave started.'
      });
      if (!changed) {
        return ResponseView.sendError(res, 'Leave day was modified concurrently — refresh and try again', 'Conflict', 409);
      }

      await AuditService.log({
        timestamp: new Date().toISOString(),
        userId: director.id,
        username: director.username,
        userRole: director.role,
        province: director.province,
        action: 'UPDATE',
        resource: 'Leave Request',
        resourceId: dayId,
        details: `Revoked approved leave day ${day.leaveDate} of ${day.ownerDisplayName || day.ownerId}${note ? ` — ${note}` : ''}`,
        clearanceLevel: director.clearanceLevel
      });

      await NotificationService.notify(
        day.ownerId,
        'Approved leave revoked',
        `${director.displayName} revoked your approved leave day on ${day.leaveDate}.${note ? ` Reason: ${note}` : ''} The day has been returned to your balance.`,
        '#/leaves'
      );
      if (day.substituteUsername) {
        await NotificationService.notify(
          day.substituteUsername,
          'Acting coordinator day cancelled',
          `Your acting Security Coordinator nomination for ${day.leaveDate} (covering ${day.ownerDisplayName || day.ownerId}) was cancelled because the leave was revoked.`,
          '#/dashboard'
        );
      }

      const updated = await LeaveModel.getById(dayId);
      ResponseView.sendSuccess(res, updated, 'Leave day revoked');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to revoke leave day');
    }
  },

  /**
   * Coordinator cancels their own day. Pending days cancel anytime; approved
   * days only until the batch starts (same lock as director revocation).
   */
  async cancel(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const dayId = String(req.params.dayId || '');

      const day = await LeaveModel.getById(dayId);
      if (!day || day.ownerId !== user.username) {
        return ResponseView.sendError(res, 'Leave day not found', 'Operation failed', 404);
      }
      if (day.status !== 'Pending' && day.status !== 'Approved') {
        return ResponseView.sendError(res, `A ${day.status.toLowerCase()} leave day cannot be cancelled`, 'Validation failed', 400);
      }

      if (day.status === 'Approved') {
        const batchDays = await LeaveModel.getByBatch(day.batchId);
        const lockDate = batchLockDate(batchDays);
        const today = sastToday();
        if (lockDate && today >= lockDate) {
          return ResponseView.sendError(res, 'This leave has already started and can no longer be cancelled', 'Validation failed', 400);
        }
      }

      const wasApproved = day.status === 'Approved';
      const changed = await LeaveModel.transitionStatus(dayId, ['Pending', 'Approved'], 'Cancelled', {
        decidedBy: user.username,
        decidedAt: new Date().toISOString(),
        decisionNote: 'Cancelled by the requesting coordinator.'
      });
      if (!changed) {
        return ResponseView.sendError(res, 'Leave day was modified concurrently — refresh and try again', 'Conflict', 409);
      }

      await AuditService.log({
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username,
        userRole: user.role,
        province: user.province,
        action: 'UPDATE',
        resource: 'Leave Request',
        resourceId: dayId,
        details: `Cancelled own ${wasApproved ? 'approved' : 'pending'} leave day ${day.leaveDate}`,
        clearanceLevel: user.clearanceLevel
      });

      const directors = await getDirectors();
      await NotificationService.notifyMany(
        directors.map(d => d.username),
        'Leave day cancelled by coordinator',
        `${user.displayName} (${user.province}) cancelled their ${wasApproved ? 'approved' : 'pending'} leave day on ${day.leaveDate}.`,
        '#/leave_management'
      );
      if (wasApproved && day.substituteUsername) {
        await NotificationService.notify(
          day.substituteUsername,
          'Acting coordinator day cancelled',
          `Your acting Security Coordinator nomination for ${day.leaveDate} was cancelled — ${user.displayName} withdrew the leave.`,
          '#/dashboard'
        );
      }

      const updated = await LeaveModel.getById(dayId);
      ResponseView.sendSuccess(res, updated, 'Leave day cancelled');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to cancel leave day');
    }
  },

  /** Chief Director adjusts a coordinator's running leave allocation. */
  async updateAllocation(req: AuthenticatedRequest, res: Response) {
    try {
      const director = req.user!;
      const username = String(req.params.username || '').trim().toLowerCase();
      const totalLeaves = Number(req.body?.totalLeaves);

      if (!Number.isInteger(totalLeaves) || totalLeaves < 0 || totalLeaves > 365) {
        return ResponseView.sendError(res, 'Total leaves must be a whole number between 0 and 365', 'Validation failed', 400);
      }

      const target = await UserModel.getByUsername(username);
      if (!target) {
        return ResponseView.sendError(res, 'User not found', 'Operation failed', 404);
      }
      if (target.role !== 'security_coordinator' || target.baseRole) {
        return ResponseView.sendError(res, 'Leave allocations apply to permanent Security Coordinators only', 'Validation failed', 400);
      }

      const committed = await LeaveModel.countCommitted(username);
      if (totalLeaves < committed) {
        return ResponseView.sendError(
          res,
          `Cannot set the allocation below ${committed} — the coordinator already has that many pending or approved leave day(s)`,
          'Validation failed',
          400
        );
      }

      const previous = target.totalLeaves ?? 0;
      const success = await UserModel.updateTotalLeaves(username, totalLeaves);
      if (!success) {
        return ResponseView.sendError(res, 'Failed to update leave allocation', 'Operation failed');
      }

      await AuditService.log({
        timestamp: new Date().toISOString(),
        userId: director.id,
        username: director.username,
        userRole: director.role,
        province: director.province,
        action: 'UPDATE',
        resource: 'Leave Allocation',
        resourceId: target.id,
        details: `Changed total leave allocation of ${target.displayName} from ${previous} to ${totalLeaves}`,
        clearanceLevel: director.clearanceLevel
      });

      await NotificationService.notify(
        target.username,
        'Leave allocation updated',
        `${director.displayName} updated your total leave allocation from ${previous} to ${totalLeaves} day(s).`,
        '#/leaves'
      );

      const updated = await UserModel.getByUsername(username);
      ResponseView.sendSuccess(res, updated, 'Leave allocation updated');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to update leave allocation');
    }
  }
};
