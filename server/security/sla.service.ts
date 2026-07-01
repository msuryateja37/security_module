import { SecurityIncident } from '../models/incident.model.js';

export interface SlaInfo {
  status: 'On Track' | 'At Risk' | 'Overdue';
  hoursRemaining: number;
  deadline: string;
  isEscalated: boolean;
}

export const SlaService = {
  /**
   * Calculates SLA compliance based on classification & creation date.
   * SLAs:
   *  - Top Secret / Secret: 24-hour resolution target
   *  - Confidential / Restricted: 72-hour resolution target
   *  - Unclassified: 120-hour (5 days) resolution target
   */
  calculateSla(incident: SecurityIncident): SlaInfo {
    const createdDate = new Date(incident.dateCreated || incident.dateTime || Date.now());
    let targetHours = 72; // Default

    if (incident.classification === 'Top Secret' || incident.classification === 'Secret') {
      targetHours = 24;
    } else if (incident.classification === 'Unclassified') {
      targetHours = 120;
    }

    const deadlineDate = new Date(createdDate.getTime() + targetHours * 60 * 60 * 1000);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const hoursRemaining = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;

    let status: 'On Track' | 'At Risk' | 'Overdue' = 'On Track';

    if (incident.status === 'Closed') {
      status = 'On Track';
    } else if (hoursRemaining < 0) {
      status = 'Overdue';
    } else if (hoursRemaining < targetHours * 0.25) {
      status = 'At Risk';
    }

    const isEscalated = status === 'Overdue' || incident.outcomeOfInvestigation?.includes('Escalated');

    return {
      status,
      hoursRemaining: incident.status === 'Closed' ? 0 : hoursRemaining,
      deadline: deadlineDate.toISOString(),
      isEscalated
    };
  }
};
