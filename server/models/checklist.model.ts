import { query, queryOne, execute } from '../config/db.js';

export interface ChecklistItem {
  id: string;
  category: 'Physical' | 'Information' | 'After-Hours' | 'Vetting';
  task: string;
  completed: boolean;
  notes?: string;
}

export interface ChecklistItemDb {
  id: string;
  category: string;
  task: string;
  completed: number;
  notes?: string;
}

export const ChecklistModel = {
  async getAll(): Promise<ChecklistItem[]> {
    const rows = await query<ChecklistItemDb>('SELECT * FROM checklist_items');
    return rows.map(row => ({
      id: row.id,
      category: row.category as any,
      task: row.task,
      completed: row.completed === 1,
      notes: row.notes || ''
    }));
  },

  async bulkSave(items: ChecklistItem[]): Promise<boolean> {
    try {
      for (const item of items) {
        // Check if the record already exists
        const existing = await queryOne<{ count: number }>(
          'SELECT COUNT(*) as count FROM checklist_items WHERE id = ?',
          [item.id]
        );

        if (existing && existing.count > 0) {
          // Update
          await execute(
            'UPDATE checklist_items SET category = ?, task = ?, completed = ?, notes = ? WHERE id = ?',
            [item.category, item.task, item.completed ? 1 : 0, item.notes || '', item.id]
          );
        } else {
          // Insert
          await execute(
            'INSERT INTO checklist_items (id, category, task, completed, notes) VALUES (?, ?, ?, ?, ?)',
            [item.id, item.category, item.task, item.completed ? 1 : 0, item.notes || '']
          );
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to save checklist items bulk:', error);
      return false;
    }
  }
};
