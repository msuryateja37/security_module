import { query, execute } from '../config/db.js';

// Per-case discussion thread (v2 user journeys — "Comments / Chat Thread").
// Free-form messages between the case parties (reporter, coordinator,
// investigator, director), each stamped with author + role + time. One level
// of threading: a reply always points at a top-level comment. Comments are
// never edited or deleted after insert (same immutability rule as the
// workflow timeline).

export interface CaseComment {
  id: string;
  incidentId: string;
  /** Top-level comment this is a reply to; null for a top-level comment. */
  parentId: string | null;
  author: string;
  authorName: string;
  authorRole: string;
  message: string;
  dateCreated: string;
}

let commentSeq = 0;

export const CaseCommentModel = {
  async create(input: Omit<CaseComment, 'id' | 'dateCreated'>): Promise<CaseComment> {
    const comment: CaseComment = {
      ...input,
      // Sequence suffix keeps ordering stable when several comments land in the same millisecond
      id: `cmt-${Date.now()}-${(commentSeq++ % 1000).toString().padStart(3, '0')}`,
      dateCreated: new Date().toISOString()
    };
    await execute(
      `INSERT INTO case_comments (id, incidentId, parentId, author, authorName, authorRole, message, dateCreated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        comment.id, comment.incidentId, comment.parentId, comment.author,
        comment.authorName, comment.authorRole, comment.message, comment.dateCreated
      ]
    );
    return comment;
  },

  async getByIncident(incidentId: string): Promise<CaseComment[]> {
    return query<CaseComment>(
      'SELECT * FROM case_comments WHERE incidentId = ? ORDER BY dateCreated ASC, id ASC',
      [incidentId]
    );
  },

  async getById(id: string): Promise<CaseComment | null> {
    const rows = await query<CaseComment>('SELECT * FROM case_comments WHERE id = ?', [id]);
    return rows[0] || null;
  }
};
