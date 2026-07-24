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
  ownerId?: string;
  // 'pending_manager' after the assessor submits, 'signed' once a manager
  // counter-signs. Legacy rows without a status are treated as 'signed'.
  status?: 'pending_manager' | 'signed';
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
  ownerId?: string;
  status?: string;
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
      dateCreated: row.dateCreated,
      ownerId: row.ownerId,
      status: (row.status as TraAudit['status']) || 'signed'
    }));
  },

  async create(audit: TraAudit): Promise<boolean> {
    const result = await execute(
      `INSERT INTO tra_audits (
        id, officeName, date, assessorName, officeLocation, time, managerName,
        assessorSignature, managerSignature, checklistValues, dateCreated, ownerId, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        audit.id, audit.officeName, audit.date, audit.assessorName, audit.officeLocation, audit.time, audit.managerName,
        audit.assessorSignature, audit.managerSignature, JSON.stringify(audit.checklistValues), audit.dateCreated,
        audit.ownerId || null, audit.status || 'pending_manager'
      ]
    );
    return result.changes !== undefined && result.changes > 0;
  },

  async getById(id: string): Promise<TraAudit | null> {
    const rows = await query<TraAuditDb>('SELECT * FROM tra_audits WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
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
      dateCreated: row.dateCreated,
      ownerId: row.ownerId,
      status: (row.status as TraAudit['status']) || 'signed'
    };
  },

  // Manager counter-signature: records the manager's drawn signature + name and
  // moves the record from 'pending_manager' to 'signed'.
  async signAsManager(id: string, managerSignature: string, managerName: string): Promise<boolean> {
    const result = await execute(
      `UPDATE tra_audits SET managerSignature = ?, managerName = ?, status = 'signed' WHERE id = ?`,
      [managerSignature, managerName, id]
    );
    return result.changes !== undefined && result.changes > 0;
  }
};
