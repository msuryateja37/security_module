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
  calculateSla(incident: SecurityIncident, rules: SlaRules = CONFIG_DEFAULTS.sla_rules): SlaInfo {
    const createdDate = new Date(incident.dateCreated || incident.dateTime || Date.now());
    const targetHours =
      rules.classificationTargets[incident.classification || ''] ?? rules.defaultTargetHours;

    const deadlineDate = new Date(createdDate.getTime() + targetHours * 60 * 60 * 1000);
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

    // Working-day investigation clock (policy: complete within 14 working days of the report)
    const reportDay = sastDateOf(createdDate.toISOString()) ?? sastToday();
    const targetDays = rules.investigationWorkingDays;
    const expectedDate = addWorkingDays(reportDay, targetDays);
    const closedDay = incident.status === 'Closed' && incident.closedAt ? sastDateOf(incident.closedAt) : null;
    const daysElapsed = workingDaysBetween(reportDay, closedDay ?? sastToday());

    return {
      status,
      hoursRemaining: incident.status === 'Closed' ? 0 : hoursRemaining,
      deadline: deadlineDate.toISOString(),
      isEscalated,
      expectedDate,
      targetDays,
      daysElapsed,
      daysRemaining: targetDays - daysElapsed
    };
  }
};
