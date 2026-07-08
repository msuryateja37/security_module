import { query, execute } from '../config/db.js';

// Fine-grained end-to-end workflow stage (the coarse `status` stays in sync for
// dashboards/SLA):
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

export interface CaseWorkflowFields {
  /** Expected resolution window selected by the reporter on the incident form. */
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
}

export interface SecurityIncidentDb extends CaseWorkflowFields {
  id: string;
  refNo: string;
  incidentType: string;
  otherIncidentTypeDetails?: string;
  department: string;
  contactDetails: string;
  dateTime: string;
  place: string;
  province: string;
  lossValue: number;
  natureOfLoss: string;
  injuriesFatalities: string;
  reportedBy: string;
  registerNumber: string;
  sapsCaseNumber?: string;
  policeStation?: string;
  arrests?: number;
  classification: string;
  reportedToSapsSsa: string;
  outcomeOfInvestigation: string;
  responsiblePerson?: string;
  status: string;
  isEscalated?: number;
  escalationLevel?: string;
  escalationReason?: string;
  escalationNotes?: string;
  escalatedBy?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  dateCreated: string;
  dateReported: string;
  ownerId?: string;
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

export interface SecurityIncident extends CaseWorkflowFields {
  id: string;
  refNo: string;
  incidentType: string[];
  otherIncidentTypeDetails?: string;
  department: string;
  contactDetails: string;
  dateTime: string;
  place: string;
  province: string;
  lossValue: number;
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

export const IncidentModel = {
  async getAll(): Promise<SecurityIncident[]> {
    const rows = await query<SecurityIncidentDb>('SELECT * FROM incidents ORDER BY dateTime DESC');
    return rows.map(row => ({
      ...row,
      incidentType: JSON.parse(row.incidentType || '[]')
    } as SecurityIncident));
  },

  async getById(id: string): Promise<SecurityIncident | null> {
    const rows = await query<SecurityIncidentDb>('SELECT * FROM incidents WHERE id = ?', [id]);
    const row = rows[0];
    if (!row) return null;

    return {
      ...row,
      incidentType: JSON.parse(row.incidentType || '[]')
    } as SecurityIncident;
  },

  async create(incident: SecurityIncident): Promise<boolean> {
    const result = await execute(
      `INSERT INTO incidents (
        id, refNo, incidentType, otherIncidentTypeDetails, department, contactDetails,
        dateTime, place, province, lossValue, natureOfLoss, injuriesFatalities, reportedBy,
        registerNumber, sapsCaseNumber, policeStation, arrests, classification, reportedToSapsSsa,
        outcomeOfInvestigation, responsiblePerson, status, natureOfCase, workflowStage,
        dateCreated, dateReported, ownerId, whatHappened,
        whereHappened, howHappened, whoResponsible, proceduresUsed, weaponsUsed, damageDone,
        actionTaken, securityMeasuresEffectiveness, securityPersonnelReaction, otherAspects,
        lessonsLearned, recommendations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incident.id,
        incident.refNo,
        JSON.stringify(incident.incidentType),
        incident.otherIncidentTypeDetails || '',
        incident.department,
        incident.contactDetails,
        incident.dateTime,
        incident.place,
        incident.province,
        incident.lossValue,
        incident.natureOfLoss,
        incident.injuriesFatalities,
        incident.reportedBy,
        incident.registerNumber,
        incident.sapsCaseNumber || '',
        incident.policeStation || '',
        incident.arrests || 0,
        incident.classification,
        incident.reportedToSapsSsa,
        incident.outcomeOfInvestigation,
        incident.responsiblePerson || '',
        incident.status,
        incident.natureOfCase || '',
        incident.workflowStage || 'Submitted',
        incident.dateCreated,
        incident.dateReported,
        incident.ownerId || null,
        incident.whatHappened || '',
        incident.whereHappened || '',
        incident.howHappened || '',
        incident.whoResponsible || '',
        incident.proceduresUsed || '',
        incident.weaponsUsed || '',
        incident.damageDone || '',
        incident.actionTaken || '',
        incident.securityMeasuresEffectiveness || '',
        incident.securityPersonnelReaction || '',
        incident.otherAspects || '',
        incident.lessonsLearned || '',
        incident.recommendations || ''
      ]
    );
    return result.changes !== undefined && result.changes > 0;
  },

  async update(id: string, incident: Partial<SecurityIncident>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    
    const validColumns = [
      'refNo', 'incidentType', 'otherIncidentTypeDetails', 'department', 'contactDetails',
      'dateTime', 'place', 'province', 'lossValue', 'natureOfLoss', 'injuriesFatalities',
      'reportedBy', 'registerNumber', 'sapsCaseNumber', 'policeStation', 'arrests',
      'classification', 'reportedToSapsSsa', 'outcomeOfInvestigation', 'responsiblePerson',
      'status', 'isEscalated', 'escalationLevel', 'escalationReason', 'escalationNotes',
      'escalatedBy', 'escalatedTo', 'escalatedAt',
      'natureOfCase', 'workflowStage', 'preliminaryFindings', 'investigationFindings',
      'assignedInvestigator', 'assignedInvestigatorBy', 'assignedInvestigatorAt',
      'investigationSubmittedAt', 'returnReason', 'returnCount',
      'approvedBy', 'approvedAt', 'approvalNotes',
      'closedBy', 'closedAt', 'closureOutcome', 'closureReport',
      'dateCreated', 'dateReported', 'whatHappened', 'whereHappened', 'howHappened',
      'whoResponsible', 'proceduresUsed', 'weaponsUsed', 'damageDone', 'actionTaken',
      'securityMeasuresEffectiveness', 'securityPersonnelReaction', 'otherAspects',
      'lessonsLearned', 'recommendations'
    ];

    for (const [key, value] of Object.entries(incident)) {
      if (key === 'id' || !validColumns.includes(key)) continue;
      fields.push(`${key} = ?`);
      if (key === 'incidentType') {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }
    
    if (fields.length === 0) return false;
    
    values.push(id);
    const queryStr = `UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`;
    const result = await execute(queryStr, values);
    
    return result.changes !== undefined && result.changes > 0;
  }
};
