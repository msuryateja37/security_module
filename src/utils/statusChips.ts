import type { SecurityIncident } from '../types/security';

// Status chip palette (bg / text) from the design handoff
// (design_handoff_security_portal/README.md — "Status chips").
const CHIP_MAP: Record<string, [string, string]> = {
  'UNDER REVIEW': ['#FDF3D7', '#8A6A16'],
  'UNDER INVESTIGATION': ['#FDF3D7', '#8A6A16'],
  'INVESTIGATION': ['#FDF3D7', '#8A6A16'],
  'SUBMITTED': ['#E8EDF2', '#3F5364'],
  'PENDING DD REVIEW': ['#FDF3D7', '#8A6A16'],
  'PENDING APPROVAL': ['#E8EDF2', '#3F5364'],
  'OPEN': ['#FDE3DC', '#9C3B24'],
  'SAPS CASE': ['#FDE3DC', '#9C3B24'],
  'ESCALATED': ['#FBDAD3', '#A83A22'],
  'APPROVED': ['#DDF5E8', '#136B4A'],
  'RESOLVED': ['#DDF5E8', '#136B4A'],
  'CLOSED': ['#DDF5E8', '#136B4A']
};

export const getStatusChipColors = (label: string): { background: string; color: string } => {
  const [background, color] = CHIP_MAP[label.toUpperCase()] || ['#EEF3F0', '#3E4E46'];
  return { background, color };
};

// Display label for a case: the fine-grained workflow stage when present,
// falling back to the coarse status. Completed cases are labelled "Approved"
// (client preference); the stored status/stage remains 'Closed' per the BRS.
export const getCaseStageLabel = (incident: SecurityIncident): string => {
  const stage = incident.workflowStage;
  if (stage) {
    return stage === 'Closed' ? 'Approved' : String(stage);
  }
  return incident.status === 'Closed' ? 'Approved' : incident.status;
};

export interface TimelineStep {
  label: string;
  sub: string;
  done: boolean;
  current: boolean;
}

const TIMELINE_ORDER = ['Submitted', 'Preliminary Review', 'Investigation', 'Resolved'];
const TIMELINE_SUBS = [
  'Incident logged and reference number issued',
  'Security coordinator screening the report',
  'Assigned investigator gathering evidence',
  'Outcome recorded and case closed'
];

// Map a case onto the 4-step progress timeline shown in the case drawer.
export const getCaseTimeline = (incident: SecurityIncident): TimelineStep[] => {
  const key = (incident.workflowStage || incident.status || 'Submitted').toUpperCase();
  const idxMap: Record<string, number> = {
    'SUBMITTED': 0,
    'OPEN': 0,
    'UNDER REVIEW': 1,
    'UNDER INVESTIGATION': 2,
    'INVESTIGATION': 2,
    'ESCALATED': 2,
    'SAPS CASE': 2,
    'PENDING DD REVIEW': 3,
    'PENDING APPROVAL': 3,
    'APPROVED': 3,
    'RESOLVED': 3,
    'CLOSED': 3
  };
  const isClosed = incident.status === 'Closed' || incident.workflowStage === 'Closed';
  const cur = isClosed ? 4 : (idxMap[key] ?? 0);

  return TIMELINE_ORDER.map((label, i) => ({
    label,
    sub: i === cur && incident.responsiblePerson
      ? `In progress — ${incident.responsiblePerson}`
      : TIMELINE_SUBS[i],
    done: i < cur,
    current: i === cur
  }));
};
