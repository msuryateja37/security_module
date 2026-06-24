import { query, execute } from '../config/db.js';
export const InvReportModel = {
    async getAll() {
        return query('SELECT * FROM investigation_reports ORDER BY dateCreated DESC');
    },
    async create(report) {
        const result = await execute(`INSERT INTO investigation_reports (
        id, subject, purpose, scope, background, factualInfo,
        findings, recommendations, officerName, rank, office, date, signature, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            report.id, report.subject, report.purpose, report.scope, report.background, report.factualInfo,
            report.findings, report.recommendations, report.officerName, report.rank, report.office, report.date, report.signature, report.dateCreated
        ]);
        return result.changes !== undefined && result.changes > 0;
    }
};
