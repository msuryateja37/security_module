import { query, execute } from '../config/db.js';

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

export const BtoReportModel = {
  async getAll(): Promise<BackToOfficeReport[]> {
    return query<BackToOfficeReport>('SELECT * FROM bto_reports ORDER BY dateCreated DESC');
  },

  async create(report: BackToOfficeReport): Promise<boolean> {
    const result = await execute(
      `INSERT INTO bto_reports (
        id, officialName, date, venue, times, staffStakeholders,
        eventName, purpose, expectedOutput, discussionPoints, mattersNoting,
        designation, signature, dateCreated, ownerId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.id, report.officialName, report.date, report.venue, report.times, report.staffStakeholders,
        report.eventName, report.purpose, report.expectedOutput, report.discussionPoints, report.mattersNoting,
        report.designation, report.signature, report.dateCreated, report.ownerId || null
      ]
    );
    return result.changes !== undefined && result.changes > 0;
  }
};
