import { query, execute } from '../config/db.js';

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

export interface QuarterlyReportDb {
  id: string;
  province: string;
  quarterNumber: string;
  year: string;
  program: string;
  branch: string;
  indicatorValues: string;
  dateCreated: string;
}

export const QtrReportModel = {
  async getAll(): Promise<QuarterlyReport[]> {
    const rows = await query<QuarterlyReportDb>('SELECT * FROM quarterly_reports ORDER BY dateCreated DESC');
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

  async create(report: QuarterlyReport): Promise<boolean> {
    const result = await execute(
      `INSERT INTO quarterly_reports (
        id, province, quarterNumber, year, program, branch, indicatorValues, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.id, report.province, report.quarterNumber, report.year, report.program, report.branch,
        JSON.stringify(report.indicatorValues), report.dateCreated
      ]
    );
    return result.changes !== undefined && result.changes > 0;
  }
};
