import { query, queryOne, execute } from '../config/db.js';

export interface PerformanceStats {
  province: string;
  indicator: string;
  monthlyValues: { [month: string]: number };
}

export interface PerformanceStatsDb {
  province: string;
  indicator: string;
  monthlyValues: string;
}

export const StatsModel = {
  async getAll(): Promise<PerformanceStats[]> {
    const rows = await query<PerformanceStatsDb>('SELECT * FROM performance_stats');
    return rows.map(row => ({
      province: row.province,
      indicator: row.indicator,
      monthlyValues: JSON.parse(row.monthlyValues || '{}')
    }));
  },

  async bulkSave(statsList: PerformanceStats[]): Promise<boolean> {
    try {
      for (const stat of statsList) {
        // Check if the record already exists
        const existing = await queryOne<{ count: number }>(
          'SELECT COUNT(*) as count FROM performance_stats WHERE province = ? AND indicator = ?',
          [stat.province, stat.indicator]
        );

        if (existing && existing.count > 0) {
          // Update
          await execute(
            'UPDATE performance_stats SET monthlyValues = ? WHERE province = ? AND indicator = ?',
            [JSON.stringify(stat.monthlyValues), stat.province, stat.indicator]
          );
        } else {
          // Insert
          await execute(
            'INSERT INTO performance_stats (province, indicator, monthlyValues) VALUES (?, ?, ?)',
            [stat.province, stat.indicator, JSON.stringify(stat.monthlyValues)]
          );
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to save performance stats bulk:', error);
      return false;
    }
  }
};
