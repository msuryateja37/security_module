import { query, execute } from '../config/db.js';

// Immutable per-case workflow timeline (FR-010: complete history of workflow
// actions and status changes). Rendered on the case file page; never updated
// or deleted after insert.

export type CaseEventType =
  | 'SUBMITTED'
  | 'REVIEW_STARTED'
  | 'PRELIMINARY_FINDINGS'
  | 'ESCALATED'
  | 'INVESTIGATOR_ASSIGNED'
  | 'FINDINGS_SUBMITTED'
  | 'RETURNED'
  | 'APPROVED'
  | 'CLOSED'
  | 'ATTACHMENT_ADDED';

export interface CaseEvent {
  id: string;
  incidentId: string;
  eventType: CaseEventType | string;
  stage: string;
  actor: string;
  actorName: string;
  actorRole: string;
  notes: string;
  dateCreated: string;
}

let eventSeq = 0;

export const CaseEventModel = {
  async record(input: Omit<CaseEvent, 'id' | 'dateCreated'>): Promise<CaseEvent> {
    const event: CaseEvent = {
      ...input,
      // Sequence suffix keeps ordering stable when several events land in the same millisecond
      id: `evt-${Date.now()}-${(eventSeq++ % 1000).toString().padStart(3, '0')}`,
      dateCreated: new Date().toISOString()
    };
    await execute(
      `INSERT INTO case_events (id, incidentId, eventType, stage, actor, actorName, actorRole, notes, dateCreated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id, event.incidentId, event.eventType, event.stage,
        event.actor, event.actorName, event.actorRole, event.notes, event.dateCreated
      ]
    );
    return event;
  },

  async getByIncident(incidentId: string): Promise<CaseEvent[]> {
    return query<CaseEvent>(
      'SELECT * FROM case_events WHERE incidentId = ? ORDER BY dateCreated ASC, id ASC',
      [incidentId]
    );
  }
};
