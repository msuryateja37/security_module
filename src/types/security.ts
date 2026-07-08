// Fine-grained end-to-end workflow stage (mirrors server/models/incident.model.ts):
//   Submitted -> Under Review -> Closed (small case)
//                             -> Escalated -> Investigation -> Pending Approval
//                                -> (Returned => Investigation) | Approved -> Closed
export type WorkflowStage =
  | 'Submitted'
  | 'Under Review'
  | 'Escalated'
  | 'Investigation'
  | 'Pending Approval'
  | 'Approved'
  | 'Closed';

/** Expected resolution window chosen by the reporter on the incident form. */
export const NATURE_OF_CASE_OPTIONS = [
  '24 to 48 hours',
  '48 hours to 7 days',
  '7 to 14 days',
  '14 to 30 days'
] as const;

export type NatureOfCase = typeof NATURE_OF_CASE_OPTIONS[number];

export const CLOSURE_OUTCOMES = ['Closed', 'Recovered', 'Referred', 'Unfounded'] as const;

export interface CaseAttachment {
  id: string;
  incidentId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: string; // reporter_document | preliminary_evidence | investigation_evidence | closure_report
  stage: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedByRole: string;
  dateCreated: string;
}

export interface CaseEvent {
  id: string;
  incidentId: string;
  eventType: string; // SUBMITTED | REVIEW_STARTED | PRELIMINARY_FINDINGS | ESCALATED | INVESTIGATOR_ASSIGNED | FINDINGS_SUBMITTED | RETURNED | APPROVED | CLOSED | ATTACHMENT_ADDED
  stage: string;
  actor: string;
  actorName: string;
  actorRole: string;
  notes: string;
  dateCreated: string;
}

export interface SlaInfo {
  status: 'On Track' | 'At Risk' | 'Overdue';
  hoursRemaining: number;
  deadline: string;
  isEscalated?: boolean;
  /** Investigation due date ('YYYY-MM-DD'): report date + the working-day target. */
  expectedDate: string;
  /** The working-day investigation target (security policy: 14 working days). */
  targetDays: number;
  /** Working days used so far — frozen at closure for closed cases. */
  daysElapsed: number;
  /** targetDays − daysElapsed; negative once the investigation deadline has passed. */
  daysRemaining: number;
}

export interface SecurityIncident {
  id: string;
  refNo: string;
  incidentType: string[];
  otherIncidentTypeDetails?: string;
  department: string;
  contactDetails: string;
  dateTime: string;
  place: string;
  province: string;
  lossValue: number; // rand value
  natureOfLoss: string;
  injuriesFatalities: string;
  reportedBy: string;
  registerNumber: string;
  sapsCaseNumber?: string;
  policeStation?: string;
  arrests?: number;
  classification: 'Unclassified' | 'Restricted' | 'Confidential' | 'Secret' | 'Top Secret';
  reportedToSapsSsa: 'Yes' | 'No' | 'Pending';
  outcomeOfInvestigation: string;
  responsiblePerson?: string;
  status: 'Open' | 'Under Investigation' | 'SAPS Case' | 'Closed';
  isEscalated?: boolean | number;
  escalationLevel?: 'Major' | 'High Risk' | 'Critical' | 'National Review';
  escalationReason?: string;
  escalationNotes?: string;
  escalatedBy?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  dateCreated: string;
  dateReported: string;
  ownerId?: string;

  // End-to-end case workflow fields
  natureOfCase?: string;
  workflowStage?: WorkflowStage | string;
  preliminaryFindings?: string;
  investigationFindings?: string;
  assignedInvestigator?: string;
  assignedInvestigatorBy?: string;
  assignedInvestigatorAt?: string;
  investigationSubmittedAt?: string;
  returnReason?: string;
  returnCount?: number;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  closedBy?: string;
  closedAt?: string;
  closureOutcome?: string;
  closureReport?: string;
  /** Attached by the server on reads (FR-019). */
  slaInfo?: SlaInfo;

  // Incident Report detail questions
  whatHappened: string;
  whereHappened: string;
  howHappened: string;
  whoResponsible: string;
  proceduresUsed: string;
  weaponsUsed: string;
  damageDone: string;
  actionTaken: string;
  securityMeasuresEffectiveness: string;
  securityPersonnelReaction: string;
  otherAspects: string;
  lessonsLearned: string;
  recommendations: string;
}

export type ProvinceType =
  | 'Gauteng'
  | 'North West'
  | 'Free State'
  | 'Limpopo'
  | 'Mpumalanga'
  | 'KwaZulu Natal'
  | 'Western Cape'
  | 'Eastern Cape'
  | 'Northern Cape';

export interface PerformanceStats {
  province: ProvinceType;
  indicator: string;
  monthlyValues: { [month: string]: number }; // month e.g., 'Apr', 'May', ... to value
}

export interface ChecklistItem {
  id: string;
  category: 'Physical' | 'Information' | 'After-Hours' | 'Vetting';
  task: string;
  completed: boolean;
  notes?: string;
}

// Back to Office Report
export interface BackToOfficeReport {
  id: string;
  officialName: string;
  date: string;
  venue: string;
  times: string;
  staffStakeholders: string;
  eventName: string;
  purpose: string;
  expectedOutput: string;
  discussionPoints: string;
  mattersNoting: string;
  designation: string;
  signature: string;
  dateCreated: string;
  ownerId?: string;
}

// Investigation Report
export interface InvestigationReport {
  id: string;
  subject: string;
  purpose: string;
  scope: string;
  background: string;
  factualInfo: string;
  findings: string;
  recommendations: string;
  officerName: string;
  rank: string;
  office: string;
  date: string;
  signature: string;
  dateCreated: string;
  ownerId?: string;
}

// Monthly and Quarterly Investigation Report
export interface QuarterlyIndicatorValue {
  annualTarget: number;
  quarterTarget: number;
  monthlyTarget: number;
  actualQuarterPerformance: number;
  month1Val: number;
  month2Val: number;
  month3Val: number;
  varianceReasons: string;
  correctiveAction: string;
}

export interface QuarterlyReport {
  id: string;
  province: string;
  quarterNumber: string;
  year: string;
  program: string;
  branch: string;
  indicatorValues: { [indicatorName: string]: QuarterlyIndicatorValue };
  dateCreated: string;
  ownerId?: string;
}

// TRA Audit
export interface TraAudit {
  id: string;
  officeName: string;
  date: string;
  assessorName: string;
  officeLocation: string;
  time: string;
  managerName: string;
  assessorSignature: string;
  managerSignature: string;
  checklistValues: {
    [itemId: string]: {
      status: 'Compliant' | 'Non-Compliant' | 'N/A';
      notes: string;
    }
  };
  dateCreated: string;
  ownerId?: string;
}
