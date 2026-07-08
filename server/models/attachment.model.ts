import { query, execute } from '../config/db.js';

// Case supporting documents / evidence metadata (FR-004, FR-014).
// Binary content is stored on disk by FileStorageService; storagePath is the
// relative path under the uploads root.

export type AttachmentCategory =
  | 'reporter_document'
  | 'preliminary_evidence'
  | 'investigation_evidence'
  | 'closure_report';

export interface CaseAttachment {
  id: string;
  incidentId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: AttachmentCategory | string;
  stage: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedByRole: string;
  storagePath: string;
  dateCreated: string;
}

export const AttachmentModel = {
  async create(att: CaseAttachment): Promise<boolean> {
    const result = await execute(
      `INSERT INTO attachments (
        id, incidentId, fileName, mimeType, fileSize, category, stage,
        uploadedBy, uploadedByName, uploadedByRole, storagePath, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        att.id, att.incidentId, att.fileName, att.mimeType, att.fileSize,
        att.category, att.stage, att.uploadedBy, att.uploadedByName,
        att.uploadedByRole, att.storagePath, att.dateCreated
      ]
    );
    return result.changes > 0;
  },

  async getByIncident(incidentId: string): Promise<CaseAttachment[]> {
    return query<CaseAttachment>(
      'SELECT * FROM attachments WHERE incidentId = ? ORDER BY dateCreated ASC',
      [incidentId]
    );
  },

  async getById(id: string): Promise<CaseAttachment | null> {
    const rows = await query<CaseAttachment>('SELECT * FROM attachments WHERE id = ?', [id]);
    return rows[0] || null;
  }
};
