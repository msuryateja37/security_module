import { query, execute } from '../config/db.js';

// Policy Hub repository (FR-030; user testing CI-0012). Metadata for the approved
// security policies and procedures; the file itself is held by FileStorageService
// under policies/, exactly like case evidence.
//
// Documents are versioned rather than replaced: publishing a new version of a title
// marks the previous rows isCurrent = 0 so historic references stay resolvable.

export interface PolicyDocument {
  id: string;
  title: string;
  category: string;
  version: string;
  effectiveDate: string;
  revisionDate: string;
  summary: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  uploadedBy: string;
  uploadedByName: string;
  isCurrent: number | boolean;
  dateCreated: string;
}

export const PolicyDocumentModel = {
  async create(doc: PolicyDocument): Promise<boolean> {
    const result = await execute(
      `INSERT INTO policy_documents (
        id, title, category, version, effectiveDate, revisionDate, summary,
        fileName, mimeType, fileSize, storagePath, uploadedBy, uploadedByName,
        isCurrent, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doc.id, doc.title, doc.category, doc.version, doc.effectiveDate, doc.revisionDate,
        doc.summary, doc.fileName, doc.mimeType, doc.fileSize, doc.storagePath,
        doc.uploadedBy, doc.uploadedByName, doc.isCurrent ? 1 : 0, doc.dateCreated
      ]
    );
    return result.changes > 0;
  },

  /** Newest first; superseded versions included so the history stays visible. */
  async getAll(): Promise<PolicyDocument[]> {
    return query<PolicyDocument>(
      'SELECT * FROM policy_documents ORDER BY isCurrent DESC, effectiveDate DESC, dateCreated DESC'
    );
  },

  async getById(id: string): Promise<PolicyDocument | null> {
    const rows = await query<PolicyDocument>('SELECT * FROM policy_documents WHERE id = ?', [id]);
    return rows[0] || null;
  },

  /** Mark every earlier row for a title as superseded when a new version lands. */
  async supersedePreviousVersions(title: string, exceptId: string): Promise<void> {
    await execute(
      'UPDATE policy_documents SET isCurrent = 0 WHERE title = ? AND id <> ?',
      [title, exceptId]
    );
  }
};
