import { query, execute } from '../config/db.js';
export const BtoReportModel = {
    async getAll() {
        return query('SELECT * FROM bto_reports ORDER BY dateCreated DESC');
    },
    async create(report) {
        const result = await execute(`INSERT INTO bto_reports (
        id, officialName, date, venue, times, staffStakeholders,
        eventName, purpose, expectedOutput, discussionPoints, mattersNoting,
        designation, signature, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            report.id, report.officialName, report.date, report.venue, report.times, report.staffStakeholders,
            report.eventName, report.purpose, report.expectedOutput, report.discussionPoints, report.mattersNoting,
            report.designation, report.signature, report.dateCreated
        ]);
        return result.changes !== undefined && result.changes > 0;
    }
};
