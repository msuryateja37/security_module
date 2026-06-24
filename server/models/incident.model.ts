import { query, execute } from '../config/db.js';

export interface SecurityIncidentDb {
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
  dateCreated: string;
  dateReported: string;
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
  dateCreated: string;
  dateReported: string;
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

  async create(incident: SecurityIncident): Promise<boolean> {
    const result = await execute(
      `INSERT INTO incidents (
        id, refNo, incidentType, otherIncidentTypeDetails, department, contactDetails,
        dateTime, place, province, lossValue, natureOfLoss, injuriesFatalities, reportedBy,
        registerNumber, sapsCaseNumber, policeStation, arrests, classification, reportedToSapsSsa,
        outcomeOfInvestigation, responsiblePerson, status, dateCreated, dateReported, whatHappened,
        whereHappened, howHappened, whoResponsible, proceduresUsed, weaponsUsed, damageDone,
        actionTaken, securityMeasuresEffectiveness, securityPersonnelReaction, otherAspects,
        lessonsLearned, recommendations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        incident.dateCreated,
        incident.dateReported,
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
    
    for (const [key, value] of Object.entries(incident)) {
      if (key === 'id') continue;
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
