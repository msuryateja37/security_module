import { query, execute } from '../config/db.js';

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

export const InvReportModel = {
  async getAll(): Promise<InvestigationReport[]> {
    return query<InvestigationReport>('SELECT * FROM investigation_reports ORDER BY dateCreated DESC');
  },

  async create(report: InvestigationReport): Promise<boolean> {
    const result = await execute(
      `INSERT INTO investigation_reports (
        id, subject, purpose, scope, background, factualInfo,
        findings, recommendations, officerName, rank, office, date, signature, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.id, report.subject, report.purpose, report.scope, report.background, report.factualInfo,
        report.findings, report.recommendations, report.officerName, report.rank, report.office, report.date, report.signature, report.dateCreated
      ]
    );
    return result.changes !== undefined && result.changes > 0;
  }
};
