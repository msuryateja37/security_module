import { query, execute } from '../config/db.js';
export const QtrReportModel = {
    async getAll() {
        const rows = await query('SELECT * FROM quarterly_reports ORDER BY dateCreated DESC');
        return rows.map(row => ({
            id: row.id,
            province: row.province,
            quarterNumber: row.quarterNumber,
            year: row.year,
            program: row.program,
            branch: row.branch,
            indicatorValues: JSON.parse(row.indicatorValues || '{}'),
            dateCreated: row.dateCreated
        }));
    },
    async create(report) {
        const result = await execute(`INSERT INTO quarterly_reports (
        id, province, quarterNumber, year, program, branch, indicatorValues, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            report.id, report.province, report.quarterNumber, report.year, report.program, report.branch,
            JSON.stringify(report.indicatorValues), report.dateCreated
        ]);
        return result.changes !== undefined && result.changes > 0;
    }
};
