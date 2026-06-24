import { query, execute } from '../config/db.js';

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

export interface TraAuditDb {
  id: string;
  officeName: string;
  date: string;
  assessorName: string;
  officeLocation: string;
  time: string;
  managerName: string;
  assessorSignature: string;
  managerSignature: string;
  checklistValues: string;
  dateCreated: string;
}

export const TraAuditModel = {
  async getAll(): Promise<TraAudit[]> {
    const rows = await query<TraAuditDb>('SELECT * FROM tra_audits ORDER BY dateCreated DESC');
    return rows.map(row => ({
      id: row.id,
      officeName: row.officeName,
      date: row.date,
      assessorName: row.assessorName,
      officeLocation: row.officeLocation,
      time: row.time,
      managerName: row.managerName,
      assessorSignature: row.assessorSignature,
      managerSignature: row.managerSignature,
      checklistValues: JSON.parse(row.checklistValues || '{}'),
      dateCreated: row.dateCreated
    }));
  },

  async create(audit: TraAudit): Promise<boolean> {
    const result = await execute(
      `INSERT INTO tra_audits (
        id, officeName, date, assessorName, officeLocation, time, managerName,
        assessorSignature, managerSignature, checklistValues, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        audit.id, audit.officeName, audit.date, audit.assessorName, audit.officeLocation, audit.time, audit.managerName,
        audit.assessorSignature, audit.managerSignature, JSON.stringify(audit.checklistValues), audit.dateCreated
      ]
    );
    return result.changes !== undefined && result.changes > 0;
  }
};
