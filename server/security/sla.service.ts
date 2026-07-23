import { SecurityIncident } from '../models/incident.model.js';
import { CONFIG_DEFAULTS, SlaRules } from '../services/config.service.js';
import { addWorkingDays, sastDateOf, sastToday, workingDaysBetween } from '../services/workdays.service.js';

export interface SlaInfo {
  status: 'On Track' | 'At Risk' | 'Overdue';
  hoursRemaining: number;
  deadline: string;
  isEscalated: boolean;
  /** Investigation due date ('YYYY-MM-DD'): report date + investigationWorkingDays. */
  expectedDate: string;
  /** The working-day investigation target (security policy: 14 working days). */
  targetDays: number;
  /** Working days used so far — frozen at closedAt once the case is closed. */
  daysElapsed: number;
  /** targetDays − daysElapsed; negative when the investigation deadline has passed. */
  daysRemaining: number;
  /** Cumulative working days granted via approved time extensions (0 when none). */
  extensionDaysGranted: number;
  /**
   * The currently-assigned coordinator's preliminary-investigation window (7 working
   * days from assignment, + any granted extension). Present only while the case is
   * under preliminary review with a responsible coordinator and the caller supplies
   * the assignment start; the investigator uses the 14-day clock above instead.
   */
  coordinatorWindow?: {
    startDate: string;
    targetDays: number;
    daysElapsed: number;
    daysRemaining: number;
    expectedDate: string;
    status: 'On Track' | 'At Risk' | 'Overdue';
  };
}

export const SlaService = {
  /**
   * Calculates SLA compliance based on classification & creation date.
   * Targets come from the system configuration (FR-037, System Administrator-managed);
   * code defaults: Top Secret / Secret 24h, Confidential / Restricted 72h, Unclassified 120h.
   * Also computes the security-policy investigation clock: due date and working days
   * elapsed/remaining since the report (14 working days by default). Day counts are
   * derived from dateCreated at read time — never stored — so they are always current.
   * Callers on hot paths load the rules once via ConfigService.getSlaRules() and pass them in.
   */
  calculateSla(
    incident: SecurityIncident,
    rules: SlaRules = CONFIG_DEFAULTS.sla_rules,
    coordinatorAssignedAt?: string | null
  ): SlaInfo {
    const createdDate = new Date(incident.dateCreated || incident.dateTime || Date.now());
    const targetHours =
      rules.classificationTargets[incident.classification || ''] ?? rules.defaultTargetHours;

    // An approved extension adds working days to every SLA clock so the breach
    // indicators recover. Applied to the hours SLA as calendar-day equivalents.
    const extDays = Math.max(0, Number(incident.extensionDaysGranted) || 0);

    const deadlineDate = new Date(createdDate.getTime() + (targetHours + extDays * 24) * 60 * 60 * 1000);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const hoursRemaining = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;

    let status: 'On Track' | 'At Risk' | 'Overdue' = 'On Track';

    if (incident.status === 'Closed') {
      status = 'On Track';
    } else if (hoursRemaining < 0) {
      status = 'Overdue';
    } else if (hoursRemaining < targetHours * (rules.atRiskThresholdPercent / 100)) {
      status = 'At Risk';
    }

    const isEscalated = status === 'Overdue' || incident.outcomeOfInvestigation?.includes('Escalated');

    // Working-day investigation clock (policy: complete within 14 working days of the
    // report; this is also the investigator's window). Any granted extension pushes it out.
    const reportDay = sastDateOf(createdDate.toISOString()) ?? sastToday();
    const targetDays = rules.investigationWorkingDays + extDays;
    const expectedDate = addWorkingDays(reportDay, targetDays);
    const closedDay = incident.status === 'Closed' && incident.closedAt ? sastDateOf(incident.closedAt) : null;
    const daysElapsed = workingDaysBetween(reportDay, closedDay ?? sastToday());

    // Coordinator preliminary-investigation window (7 working days from assignment,
    // + any granted extension). Computed only when the caller supplies the assignment
    // start and the case is still with a responsible coordinator under review.
    let coordinatorWindow: SlaInfo['coordinatorWindow'];
    const coordStart = coordinatorAssignedAt ? sastDateOf(coordinatorAssignedAt) : null;
    if (coordStart && (incident.workflowStage || '') === 'Under Review') {
      const coordBase = rules.coordinatorInvestigationDays ?? 7;
      const coordTarget = coordBase + extDays;
      const coordElapsed = workingDaysBetween(coordStart, closedDay ?? sastToday());
      const coordRemaining = coordTarget - coordElapsed;
      const coordStatus: 'On Track' | 'At Risk' | 'Overdue' =
        incident.status === 'Closed' ? 'On Track'
          : coordRemaining < 0 ? 'Overdue'
          : coordRemaining <= Math.ceil(coordBase * (rules.atRiskThresholdPercent / 100)) ? 'At Risk'
          : 'On Track';
      coordinatorWindow = {
        startDate: coordStart,
        targetDays: coordTarget,
        daysElapsed: coordElapsed,
        daysRemaining: coordRemaining,
        expectedDate: addWorkingDays(coordStart, coordTarget),
        status: coordStatus
      };
    }

    return {
      status,
      hoursRemaining: incident.status === 'Closed' ? 0 : hoursRemaining,
      deadline: deadlineDate.toISOString(),
      isEscalated,
      expectedDate,
      targetDays,
      daysElapsed,
      daysRemaining: targetDays - daysElapsed,
      extensionDaysGranted: extDays,
      coordinatorWindow
    };
  },

  /**
   * Assignment SLA: a Submitted incident must be assigned to a coordinator within
   * `assignmentSlaHours` (default 24) of being reported. Returns whether that window
   * has elapsed while the incident is still unassigned.
   */
  isAssignmentBreached(incident: SecurityIncident, rules: SlaRules = CONFIG_DEFAULTS.sla_rules, now: Date = new Date()): boolean {
    const stage = incident.workflowStage || 'Submitted';
    const unassigned = !incident.responsiblePerson || incident.responsiblePerson === 'Unassigned';
    if (stage !== 'Submitted' || !unassigned) return false;

    const reportedAt = new Date(incident.dateReported || incident.dateCreated || incident.dateTime || now.toISOString());
    const slaHours = rules.assignmentSlaHours ?? 24;
    const deadlineMs = reportedAt.getTime() + slaHours * 60 * 60 * 1000;
    return now.getTime() >= deadlineMs;
  },

  /**
   * Assignment-SLA pre-breach warning window: a still-unassigned Submitted incident
   * that has passed `assignmentWarningHours` (default 18) but not yet the
   * `assignmentSlaHours` breach point (default 24). Used to nudge the national roles
   * before the deadline so they can assign a coordinator in time.
   */
  isAssignmentWarning(incident: SecurityIncident, rules: SlaRules = CONFIG_DEFAULTS.sla_rules, now: Date = new Date()): boolean {
    const stage = incident.workflowStage || 'Submitted';
    const unassigned = !incident.responsiblePerson || incident.responsiblePerson === 'Unassigned';
    if (stage !== 'Submitted' || !unassigned) return false;

    const reportedAt = new Date(incident.dateReported || incident.dateCreated || incident.dateTime || now.toISOString());
    const warnHours = rules.assignmentWarningHours ?? 18;
    const breachHours = rules.assignmentSlaHours ?? 24;
    const elapsedMs = now.getTime() - reportedAt.getTime();
    return elapsedMs >= warnHours * 60 * 60 * 1000 && elapsedMs < breachHours * 60 * 60 * 1000;
  }
};
