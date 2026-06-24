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
  dateCreated: string;
  dateReported: string;
  
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
}
