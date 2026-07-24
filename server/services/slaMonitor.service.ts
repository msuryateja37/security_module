import { query } from '../config/db.js';
import { IncidentModel } from '../models/incident.model.js';
import { CaseEventModel } from '../models/caseEvent.model.js';
import { AttachmentModel } from '../models/attachment.model.js';
import { UserModel } from '../models/user.model.js';
import { SlaService } from '../security/sla.service.js';
import { ConfigService } from './config.service.js';
import { NotificationService } from './notification.service.js';

// Assignment-SLA monitor. A Submitted incident must be assigned to a coordinator
// within `assignmentSlaHours` (default 24) of being reported (FR-016/FR-018/FR-020).
// This sweep detects breaches, records each once on the case timeline (immutable
// audit — FR-020), and alerts the national roles (Chief Security Director + Deputy
// Director) so they can open the case and assign a coordinator.
//
// Runs hourly + on boot; every step is idempotent so overlapping runs are harmless.

const alreadyBreachLogged = async (incidentId: string): Promise<boolean> => {
  const rows = await query<{ id: string }>(
    `SELECT id FROM case_events WHERE incidentId = ? AND eventType = 'SLA_BREACHED'`,
    [incidentId]
  );
  return rows.length > 0;
};

const alreadyAlerted = async (username: string, refNo: string): Promise<boolean> => {
  // Scope by the breach-specific title so the earlier "New incident {refNo} reported"
  // notification (which also contains refNo) never suppresses a genuine breach alert.
  const rows = await query<{ id: string }>(
    `SELECT id FROM notifications WHERE username = ? AND title LIKE 'SLA breach%' AND message LIKE ?`,
    [username, `%${refNo}%`]
  );
  return rows.length > 0;
};

const alreadyAssignmentWarnLogged = async (incidentId: string): Promise<boolean> => {
  const rows = await query<{ id: string }>(
    `SELECT id FROM case_events WHERE incidentId = ? AND eventType = 'ASSIGNMENT_SLA_WARNING'`,
    [incidentId]
  );
  return rows.length > 0;
};

const alreadyAssignmentWarnAlerted = async (username: string, refNo: string): Promise<boolean> => {
  const rows = await query<{ id: string }>(
    `SELECT id FROM notifications WHERE username = ? AND title LIKE 'Assignment SLA warning%' AND message LIKE ?`,
    [username, `%${refNo}%`]
  );
  return rows.length > 0;
};

const alreadyPreBreachWarned = async (incidentId: string): Promise<boolean> => {
  const rows = await query<{ id: string }>(
    `SELECT id FROM case_events WHERE incidentId = ? AND eventType = 'COORDINATOR_SLA_WARNING'`,
    [incidentId]
  );
  return rows.length > 0;
};

// When the coordinator's 7-day preliminary-investigation clock started: the moment
// they were assigned (director/DD routing) or self-accepted the case. The earliest
// such event is the start of the window.
const coordinatorAssignedAt = async (incidentId: string): Promise<Date | null> => {
  const rows = await query<{ dateCreated: string }>(
    `SELECT dateCreated FROM case_events
     WHERE incidentId = ? AND eventType IN ('COORDINATOR_ASSIGNED', 'REVIEW_STARTED')
     ORDER BY dateCreated ASC`,
    [incidentId]
  );
  return rows[0] ? new Date(rows[0].dateCreated) : null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const SlaMonitorService = {
  async runAssignmentSweep(): Promise<void> {
    try {
      const rules = await ConfigService.getSlaRules();
      const slaHours = rules.assignmentSlaHours ?? 24;
      const now = new Date();
      const incidents = await IncidentModel.getAll();
      // Every still-unassigned, Submitted incident — a pre-breach warning fires first
      // (from assignmentWarningHours), the breach alert once the deadline passes.
      const pending = incidents.filter(inc =>
        (inc.workflowStage || 'Submitted') === 'Submitted' &&
        (!inc.responsiblePerson || inc.responsiblePerson === 'Unassigned')
      );
      if (pending.length === 0) return;

      const nationalRoles = (await UserModel.getAll()).filter(
        u => u.role === 'security_director' || u.role === 'deputy_director'
      );
      const templates = await ConfigService.getNotificationTemplates();
      const breachTemplate = templates.assignment_sla_breach;
      const warnTemplate = templates.assignment_sla_warning;

      for (const inc of pending) {
        if (SlaService.isAssignmentBreached(inc, rules, now)) {
          // --- Breach: record once (FR-020) + alert the national roles ---
          if (!(await alreadyBreachLogged(inc.id))) {
            await CaseEventModel.record({
              incidentId: inc.id,
              eventType: 'SLA_BREACHED',
              stage: inc.workflowStage || 'Submitted',
              actor: 'system',
              actorName: 'SLA Monitor',
              actorRole: 'system',
              notes: `Assignment SLA breached — incident ${inc.refNo} not assigned to a coordinator within ${slaHours} hours of being reported`
            });
          }
          if (!breachTemplate) continue;
          const rendered = ConfigService.renderTemplate(breachTemplate, {
            refNo: inc.refNo,
            province: inc.province,
            classification: inc.classification || 'Unclassified',
            reportedAt: (inc.dateReported || inc.dateCreated || '').slice(0, 10),
            hours: slaHours
          });
          for (const recipient of nationalRoles) {
            if (await alreadyAlerted(recipient.username, inc.refNo)) continue;
            await NotificationService.notify(recipient.username, rendered.title, rendered.message, `#/case/${inc.id}`);
          }
        } else if (SlaService.isAssignmentWarning(inc, rules, now)) {
          // --- Pre-breach warning: record once + nudge the national roles before breach ---
          if (!(await alreadyAssignmentWarnLogged(inc.id))) {
            await CaseEventModel.record({
              incidentId: inc.id,
              eventType: 'ASSIGNMENT_SLA_WARNING',
              stage: inc.workflowStage || 'Submitted',
              actor: 'system',
              actorName: 'SLA Monitor',
              actorRole: 'system',
              notes: `Assignment SLA pre-breach warning — incident ${inc.refNo} still unassigned; ${slaHours}h assignment deadline approaching`
            });
          }
          if (!warnTemplate) continue;
          const reportedAt = new Date(inc.dateReported || inc.dateCreated || inc.dateTime || now.toISOString());
          const hoursToBreach = Math.max(0, Math.round((reportedAt.getTime() + slaHours * 60 * 60 * 1000 - now.getTime()) / (60 * 60 * 1000)));
          const rendered = ConfigService.renderTemplate(warnTemplate, {
            refNo: inc.refNo,
            province: inc.province,
            classification: inc.classification || 'Unclassified',
            reportedAt: (inc.dateReported || inc.dateCreated || '').slice(0, 10),
            slaHours,
            hoursToBreach
          });
          for (const recipient of nationalRoles) {
            if (await alreadyAssignmentWarnAlerted(recipient.username, inc.refNo)) continue;
            await NotificationService.notify(recipient.username, rendered.title, rendered.message, `#/case/${inc.id}`);
          }
        }
      }
    } catch (err) {
      console.error('[SlaMonitorService] assignment sweep failed:', err);
    }
  },

  /**
   * Coordinator preliminary-investigation pre-breach warning. Once a coordinator is
   * assigned a case (or self-accepts it) they get `coordinatorInvestigationDays`
   * (default 7) to complete the preliminary investigation. If, by
   * `coordinatorWarningDays` (default 6) after assignment, they have captured no
   * preliminary findings AND uploaded no documents/evidence to the case file, warn
   * the Chief Security Director and Deputy Director (national oversight) that an SLA
   * breach is likely so they can follow up. The warning is recorded once on the
   * immutable case timeline (FR-020) and fires exactly once per case.
   *
   * Runs hourly + on boot alongside the assignment sweep; every step is idempotent.
   */
  async runCoordinatorInvestigationSweep(): Promise<void> {
    try {
      const rules = await ConfigService.getSlaRules();
      const warnDays = rules.coordinatorWarningDays ?? 6;
      const investigationDays = rules.coordinatorInvestigationDays ?? 7;
      const now = Date.now();

      const incidents = await IncidentModel.getAll();
      // Cases still in the coordinator's hands: under preliminary review with a
      // responsible coordinator. Once submitted to the DD / escalated / closed the
      // coordinator's window no longer applies.
      const candidates = incidents.filter(inc =>
        (inc.workflowStage || '') === 'Under Review' &&
        !!inc.responsiblePerson &&
        inc.responsiblePerson !== 'Unassigned'
      );
      if (candidates.length === 0) return;

      const templates = await ConfigService.getNotificationTemplates();
      const template = templates.coordinator_prebreach_warning;
      const directors = (await UserModel.getAll()).filter(
        u => u.role === 'security_director' || u.role === 'deputy_director'
      );

      for (const inc of candidates) {
        if (await alreadyPreBreachWarned(inc.id)) continue;

        // Any preliminary findings text or a document the coordinator added to the
        // case file counts as investigation work — no warning then. (Reporter-uploaded
        // documents at submission don't count: they aren't the coordinator's findings.)
        const attachments = await AttachmentModel.getByIncident(inc.id);
        const hasWork =
          !!(inc.preliminaryFindings || '').trim() ||
          attachments.some(a =>
            a.uploadedByName === inc.responsiblePerson ||
            a.category === 'preliminary_evidence' ||
            a.category === 'investigation_evidence'
          );
        if (hasWork) continue;

        const assignedAt = await coordinatorAssignedAt(inc.id);
        if (!assignedAt) continue; // can't establish when the clock started — don't guess

        const elapsedMs = now - assignedAt.getTime();
        if (elapsedMs < warnDays * DAY_MS) continue; // not yet at the warning day
        const elapsedDays = Math.floor(elapsedMs / DAY_MS);

        // Record the warning once on the immutable case timeline (FR-020) — this is
        // also the idempotency guard, so it must precede the notification fan-out.
        await CaseEventModel.record({
          incidentId: inc.id,
          eventType: 'COORDINATOR_SLA_WARNING',
          stage: inc.workflowStage || 'Under Review',
          actor: 'system',
          actorName: 'SLA Monitor',
          actorRole: 'system',
          notes: `Pre-breach warning — ${inc.responsiblePerson} has captured no preliminary findings or documents ${elapsedDays} day(s) after assignment (preliminary-investigation deadline: ${investigationDays} days). Chief Security Director and Deputy Director notified.`
        });

        if (!template) continue;
        const rendered = ConfigService.renderTemplate(template, {
          refNo: inc.refNo,
          province: inc.province,
          coordinator: inc.responsiblePerson || 'The coordinator',
          assignedAt: assignedAt.toISOString().slice(0, 10),
          elapsedDays,
          investigationDays
        });
        for (const recipient of directors) {
          await NotificationService.notify(recipient.username, rendered.title, rendered.message, `#/case/${inc.id}`);
        }
      }
    } catch (err) {
      console.error('[SlaMonitorService] coordinator investigation sweep failed:', err);
    }
  }
};
