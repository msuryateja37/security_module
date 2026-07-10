import { Response } from 'express';
import { IncidentModel, SecurityIncident } from '../models/incident.model.js';
import { AttachmentModel } from '../models/attachment.model.js';
import { CaseEventModel } from '../models/caseEvent.model.js';
import { UserModel } from '../models/user.model.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { AuditService } from '../security/audit.service.js';
import { SlaService } from '../security/sla.service.js';
import { UserProfile } from '../security/roleAccess.js';
import { FileStorageService } from '../services/fileStorage.service.js';
import { NotificationService } from '../services/notification.service.js';
import { ConfigService } from '../services/config.service.js';
import { LeaveService } from '../services/leave.service.js';

// End-to-end case workflow (client process-flow document, June 2026):
//   1. Employee raises incident            -> Submitted
//   2. Security Coordinator reviews        -> Under Review
//      small case: coordinator closes      -> Closed
//      big case: coordinator escalates     -> Escalated (Chief Security Director)
//   3. Director assigns Chief Investigator -> Investigation
//   4. Investigator captures field findings and submits -> Pending Approval
//   5. Director reviews: approve -> Approved (coordinator closes -> Closed)
//                        return  -> Investigation (cycle repeats)
//   6. Reporter is notified of the outcome at closure.

export const CLOSURE_OUTCOMES = ['Closed', 'Recovered', 'Referred', 'Unfounded'];

/** Read access to a case file mirrors the list scoping in IncidentController.getAll. */
export const canReadIncident = (user: UserProfile, incident: SecurityIncident): boolean => {
  switch (user.role) {
    case 'security_director':
      return true;
    case 'security_coordinator':
      return incident.province === user.province || incident.province === 'National';
    case 'chief_security_investigator':
      return incident.responsiblePerson === user.displayName || incident.assignedInvestigator === user.displayName;
    default: // employee, system_administrator — own reports only
      return (
        incident.ownerId === user.username ||
        incident.reportedBy === user.displayName ||
        incident.contactDetails === user.email
      );
  }
};

const isCoordinatorForCase = (user: UserProfile, incident: SecurityIncident): boolean => {
  if (user.role !== 'security_coordinator') return false;
  if (incident.province !== user.province) return false;
  return (
    !incident.responsiblePerson ||
    incident.responsiblePerson === 'Unassigned' ||
    incident.responsiblePerson === user.displayName
  );
};

const audit = (user: UserProfile, action: 'CREATE' | 'READ' | 'UPDATE', incidentId: string, details: string) =>
  AuditService.log({
    timestamp: new Date().toISOString(),
    userId: user.id,
    username: user.username,
    userRole: user.role,
    province: user.province,
    action,
    resource: 'Incident',
    resourceId: incidentId,
    details,
    clearanceLevel: user.clearanceLevel
  });

const recordEvent = (
  incidentId: string,
  eventType: string,
  stage: string,
  user: UserProfile,
  notes: string
) =>
  CaseEventModel.record({
    incidentId,
    eventType,
    stage,
    actor: user.username,
    actorName: user.displayName,
    actorRole: user.role,
    notes
  });

/** Notify every active user holding a given role (e.g. all Chief Security Directors, FR-007). */
const notifyRole = async (role: string, title: string, message: string, link?: string) => {
  const users = await UserModel.getAll();
  const usernames = users.filter(u => u.role === role).map(u => u.username);
  await NotificationService.notifyMany(usernames, title, message, link);
};

const notifyFromTemplate = async (
  templateKey: string,
  vars: Record<string, string | number>,
  recipients: string[],
  link?: string
) => {
  const templates = await ConfigService.getNotificationTemplates();
  const template = templates[templateKey];
  if (!template || recipients.length === 0) return;
  const rendered = ConfigService.renderTemplate(template, vars);
  await NotificationService.notifyMany(recipients, rendered.title, rendered.message, link);
};

const caseLink = (incidentId: string) => `#/case/${incidentId}`;

/**
 * Progress notification to the original reporter — sent on every workflow
 * status/stage change performed by someone else ("receives automated
 * notifications on progress", employee journey). Deliberately NOT sent for
 * document uploads or findings edits: investigation material is internal,
 * need-to-know content (POPIA/MISS).
 */
export const notifyReporterOfProgress = async (
  incident: Pick<SecurityIncident, 'id' | 'refNo' | 'ownerId'> &
    Partial<Pick<SecurityIncident, 'reportedBy' | 'contactDetails'>>,
  actor: UserProfile,
  update: string
) => {
  // Records without an ownerId (imported/legacy): match the reporter by name or email
  let recipient = incident.ownerId;
  if (!recipient) {
    const users = await UserModel.getAll();
    recipient = users.find(u =>
      (!!incident.reportedBy && u.displayName === incident.reportedBy) ||
      (!!incident.contactDetails && u.email === incident.contactDetails)
    )?.username;
  }
  if (!recipient || recipient === actor.username) return;
  const templates = await ConfigService.getNotificationTemplates();
  const template = templates.case_activity;
  if (!template) return;
  const rendered = ConfigService.renderTemplate(template, { refNo: incident.refNo, update });
  await NotificationService.notify(recipient, rendered.title, rendered.message, caseLink(incident.id));
};

export const CaseWorkflowController = {
  /** Full case file: incident + attachments + workflow timeline + live SLA. */
  async getDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;

      const incident = await IncidentModel.getById(id);
      if (!incident) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }
      if (!canReadIncident(user, incident)) {
        return ResponseView.sendError(res, 'Access denied for this incident', 'Forbidden', 403);
      }

      const [attachments, events, slaRules] = await Promise.all([
        AttachmentModel.getByIncident(id),
        CaseEventModel.getByIncident(id),
        ConfigService.getSlaRules()
      ]);

      await audit(user, 'READ', id, `Opened case file ${incident.refNo}`);

      ResponseView.sendSuccess(res, {
        incident: { ...incident, slaInfo: SlaService.calculateSla(incident, slaRules) },
        attachments,
        events
      }, 'Fetched case file successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch case file');
    }
  },

  /** Upload a supporting document / evidence file (base64 JSON body). */
  async uploadAttachment(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const { fileName, mimeType, dataBase64, category } = req.body || {};

      if (!fileName || !dataBase64) {
        return ResponseView.sendError(res, 'fileName and dataBase64 are required', 'Validation failed', 400);
      }
      if (!FileStorageService.isAllowedFileName(fileName)) {
        return ResponseView.sendError(res, `File type of '${fileName}' is not allowed`, 'Validation failed', 400);
      }

      const incident = await IncidentModel.getById(id);
      if (!incident) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }
      if (!canReadIncident(user, incident)) {
        return ResponseView.sendError(res, 'Access denied for this incident', 'Forbidden', 403);
      }
      if (incident.status === 'Closed') {
        return ResponseView.sendError(res, 'Closed cases are immutable — no further uploads are allowed', 'Validation failed', 400);
      }

      const attachmentId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let stored;
      try {
        // Folder-per-case in the document store, named after the case reference
        stored = await FileStorageService.saveBase64(incident.refNo || id, attachmentId, fileName, dataBase64, mimeType);
      } catch (err: any) {
        return ResponseView.sendError(res, err.message || 'Failed to store file', 'Validation failed', 400);
      }

      const attachment = {
        id: attachmentId,
        incidentId: id,
        fileName,
        mimeType: mimeType || 'application/octet-stream',
        fileSize: stored.fileSize,
        category: category || 'reporter_document',
        stage: incident.workflowStage || 'Submitted',
        uploadedBy: user.username,
        uploadedByName: user.displayName,
        uploadedByRole: user.role,
        storagePath: stored.storagePath,
        dateCreated: new Date().toISOString()
      };
      await AttachmentModel.create(attachment);
      await recordEvent(id, 'ATTACHMENT_ADDED', incident.workflowStage || 'Submitted', user, `Uploaded "${fileName}" (${Math.max(1, Math.round(stored.fileSize / 1024))} KB)`);
      await audit(user, 'CREATE', id, `Uploaded attachment "${fileName}" to ${incident.refNo}`);

      ResponseView.sendSuccess(res, attachment, 'Attachment uploaded successfully', 201);
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to upload attachment');
    }
  },

  /** Stream a stored attachment back to an authorised user. */
  async downloadAttachment(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const attachmentId = req.params.attachmentId as string;

      const incident = await IncidentModel.getById(id);
      if (!incident) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }
      if (!canReadIncident(user, incident)) {
        return ResponseView.sendError(res, 'Access denied for this incident', 'Forbidden', 403);
      }

      const attachment = await AttachmentModel.getById(attachmentId);
      if (!attachment || attachment.incidentId !== id) {
        return ResponseView.sendError(res, 'Attachment not found', 'Operation failed', 404);
      }
      if (!(await FileStorageService.exists(attachment.storagePath))) {
        return ResponseView.sendError(res, 'Stored file is missing from the upload store', 'Operation failed', 410);
      }

      await audit(user, 'READ', id, `Downloaded attachment "${attachment.fileName}" from ${incident.refNo}`);

      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', attachment.fileSize);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName.replace(/[^\w.\- ()]/g, '_')}"`);
      const stream = await FileStorageService.openReadStream(attachment.storagePath);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to download attachment');
    }
  },

  /** Coordinator accepts a submitted case and starts the preliminary review. */
  async startReview(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;

      const incident = await IncidentModel.getById(id);
      if (!incident) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }

      const allowed = user.role === 'security_director' || isCoordinatorForCase(user, incident);
      if (!allowed) {
        return ResponseView.sendError(res, 'Access denied for this incident', 'Forbidden', 403);
      }
      if ((incident.workflowStage || 'Submitted') !== 'Submitted') {
        return ResponseView.sendError(res, `Case is already at stage '${incident.workflowStage}'`, 'Validation failed', 400);
      }

      const updates: Partial<SecurityIncident> = {
        workflowStage: 'Under Review',
        status: 'Under Investigation',
        responsiblePerson: user.role === 'security_coordinator' ? user.displayName : incident.responsiblePerson
      };
      await IncidentModel.update(id, updates);
      await recordEvent(id, 'REVIEW_STARTED', 'Under Review', user, `${user.displayName} accepted the case and started the preliminary review`);
      await audit(user, 'UPDATE', id, `Started review of ${incident.refNo}`);

      if (incident.ownerId) {
        await notifyFromTemplate('case_review_started', {
          refNo: incident.refNo,
          coordinator: user.displayName
        }, [incident.ownerId], caseLink(id));
      }

      ResponseView.sendSuccess(res, { ...incident, ...updates }, 'Review started successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to start review');
    }
  },

  /** Coordinator captures/updates preliminary investigation findings. */
  async savePreliminaryFindings(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const { preliminaryFindings } = req.body || {};

      if (!preliminaryFindings || !String(preliminaryFindings).trim()) {
        return ResponseView.sendError(res, 'preliminaryFindings is required', 'Validation failed', 400);
      }

      const incident = await IncidentModel.getById(id);
      if (!incident) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }
      const allowed = user.role === 'security_director' || isCoordinatorForCase(user, incident);
      if (!allowed) {
        return ResponseView.sendError(res, 'Access denied for this incident', 'Forbidden', 403);
      }
      if (incident.status === 'Closed') {
        return ResponseView.sendError(res, 'Closed cases are immutable', 'Validation failed', 400);
      }

      const updates: Partial<SecurityIncident> = { preliminaryFindings: String(preliminaryFindings).trim() };
      // Capturing findings on a freshly submitted case implicitly starts the review
      if ((incident.workflowStage || 'Submitted') === 'Submitted') {
        updates.workflowStage = 'Under Review';
        updates.status = 'Under Investigation';
        if (user.role === 'security_coordinator') updates.responsiblePerson = user.displayName;
      }

      await IncidentModel.update(id, updates);
      await recordEvent(id, 'PRELIMINARY_FINDINGS', updates.workflowStage || incident.workflowStage || 'Under Review', user, 'Preliminary investigation findings captured');
      await audit(user, 'UPDATE', id, `Captured preliminary findings on ${incident.refNo}`);

      ResponseView.sendSuccess(res, { ...incident, ...updates }, 'Preliminary findings saved');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to save preliminary findings');
    }
  },

  /**
   * Close a case with an outcome classification.
   * Coordinator: small cases (before escalation) and director-approved cases in their province.
   * Director: any open case (final authority).
   */
  async closeCase(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const { closureOutcome, closureReport } = req.body || {};

      if (!closureOutcome || !CLOSURE_OUTCOMES.includes(closureOutcome)) {
        return ResponseView.sendError(res, `closureOutcome must be one of: ${CLOSURE_OUTCOMES.join(', ')}`, 'Validation failed', 400);
      }
      if (!closureReport || !String(closureReport).trim()) {
        return ResponseView.sendError(res, 'A closure report / outcome summary is required', 'Validation failed', 400);
      }

      const incident = await IncidentModel.getById(id);
      if (!incident) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }
      if (incident.status === 'Closed') {
        return ResponseView.sendError(res, 'Case is already closed', 'Validation failed', 400);
      }

      const stage = incident.workflowStage || 'Submitted';
      if (user.role === 'security_coordinator') {
        if (!isCoordinatorForCase(user, incident)) {
          return ResponseView.sendError(res, 'Access denied for this incident', 'Forbidden', 403);
        }
        if (!['Submitted', 'Under Review', 'Approved'].includes(stage)) {
          return ResponseView.sendError(
            res,
            `An escalated case can only be closed after the Chief Security Director approves the investigation (current stage: ${stage})`,
            'Validation failed',
            400
          );
        }
      } else if (user.role !== 'security_director') {
        return ResponseView.sendError(res, 'Only coordinators and the Chief Security Director may close cases', 'Forbidden', 403);
      }

      const closedAt = new Date().toISOString();
      const summary = [
        incident.outcomeOfInvestigation || '',
        `[Closed ${closedAt}] ${user.displayName} closed the case. Outcome: ${closureOutcome}. ${String(closureReport).trim()}`
      ].filter(Boolean).join('\n\n');

      const updates: Partial<SecurityIncident> = {
        status: 'Closed',
        workflowStage: 'Closed',
        closedBy: user.displayName,
        closedAt,
        closureOutcome,
        closureReport: String(closureReport).trim(),
        outcomeOfInvestigation: summary
      };
      await IncidentModel.update(id, updates);
      await recordEvent(id, 'CLOSED', 'Closed', user, `Case closed — outcome: ${closureOutcome}. ${String(closureReport).trim()}`);
      await audit(user, 'UPDATE', id, `Closed ${incident.refNo} with outcome ${closureOutcome}`);

      // Notify the final outcome (process step 11): original reporter, the
      // investigation chain, and the Chief Security Director (national oversight).
      const vars = {
        refNo: incident.refNo,
        province: incident.province,
        outcome: closureOutcome,
        closedBy: user.displayName,
        summary: String(closureReport).trim()
      };
      const allUsers = await UserModel.getAll();

      // Reporter: fall back to name/email matching for records without an ownerId
      const reporter = incident.ownerId
        ? allUsers.find(u => u.username === incident.ownerId)
        : allUsers.find(u =>
            u.displayName === incident.reportedBy ||
            (!!incident.contactDetails && u.email === incident.contactDetails));
      const chain = new Set<string>();
      if (reporter) chain.add(reporter.username);
      // Keep the investigation chain informed on escalated cases
      if (incident.assignedInvestigator) {
        const investigator = allUsers.find(u => u.displayName === incident.assignedInvestigator);
        if (investigator) chain.add(investigator.username);
      }
      chain.delete(user.username); // no self-notification for whoever closed it
      await notifyFromTemplate('case_closed', vars, [...chain], caseLink(id));

      // Chief Security Director(s) get closure oversight of every case they didn't close themselves
      const directors = allUsers
        .filter(u => u.role === 'security_director' && u.username !== user.username && !chain.has(u.username))
        .map(u => u.username);
      await notifyFromTemplate('case_closed_oversight', vars, directors, caseLink(id));

      ResponseView.sendSuccess(res, { ...incident, ...updates }, 'Case closed successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to close case');
    }
  },

  /** List active Chief Investigators (for the director's assignment dropdown). */
  async listInvestigators(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await UserModel.getAll();
      const investigators = users
        .filter(u => u.role === 'chief_security_investigator')
        .map(u => ({ username: u.username, displayName: u.displayName, office: u.office, province: u.province }));
      ResponseView.sendSuccess(res, investigators, 'Fetched investigators successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch investigators');
    }
  },

  /** Director assigns (or reassigns) a Chief Investigator to an escalated case. */
  async assignInvestigator(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const { investigatorUsername, instructions } = req.body || {};

      if (!investigatorUsername) {
        return ResponseView.sendError(res, 'investigatorUsername is required', 'Validation failed', 400);
      }

      const incident = await IncidentModel.getById(id);
      if (!incident) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }
      const stage = incident.workflowStage || 'Submitted';
      if (!['Escalated', 'Investigation'].includes(stage)) {
        return ResponseView.sendError(res, `An investigator can only be assigned to an escalated case (current stage: ${stage})`, 'Validation failed', 400);
      }

      const investigator = await UserModel.getByUsername(investigatorUsername);
      if (!investigator || investigator.role !== 'chief_security_investigator') {
        return ResponseView.sendError(res, 'Selected user is not an active Chief Investigator', 'Validation failed', 400);
      }

      const assignedAt = new Date().toISOString();
      const updates: Partial<SecurityIncident> = {
        workflowStage: 'Investigation',
        status: 'Under Investigation',
        responsiblePerson: investigator.displayName,
        assignedInvestigator: investigator.displayName,
        assignedInvestigatorBy: user.displayName,
        assignedInvestigatorAt: assignedAt
      };
      await IncidentModel.update(id, updates);
      await recordEvent(id, 'INVESTIGATOR_ASSIGNED', 'Investigation', user,
        `${investigator.displayName} assigned for field investigation${instructions ? `. Instructions: ${String(instructions).trim()}` : ''}`);
      await audit(user, 'UPDATE', id, `Assigned ${investigator.displayName} to ${incident.refNo}`);

      await notifyFromTemplate('case_assigned', {
        refNo: incident.refNo,
        province: incident.province,
        assignedBy: user.displayName,
        instructions: instructions ? `Instructions: ${String(instructions).trim()}` : ''
      }, [investigator.username], caseLink(id));

      await notifyReporterOfProgress(incident, user,
        `A field investigator has been assigned to your incident ${incident.refNo}. The detailed investigation is now underway.`);

      ResponseView.sendSuccess(res, { ...incident, ...updates }, 'Investigator assigned successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to assign investigator');
    }
  },

  /** Chief Investigator submits field findings for the director's approval. */
  async submitInvestigation(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const { investigationFindings } = req.body || {};

      if (!investigationFindings || !String(investigationFindings).trim()) {
        return ResponseView.sendError(res, 'investigationFindings is required', 'Validation failed', 400);
      }

      const incident = await IncidentModel.getById(id);
      if (!incident) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }
      const isAssigned =
        incident.responsiblePerson === user.displayName || incident.assignedInvestigator === user.displayName;
      if (!isAssigned) {
        return ResponseView.sendError(res, 'This case is not assigned to you', 'Forbidden', 403);
      }
      if ((incident.workflowStage || '') !== 'Investigation') {
        return ResponseView.sendError(res, `Findings can only be submitted while the case is under field investigation (current stage: ${incident.workflowStage})`, 'Validation failed', 400);
      }

      const submittedAt = new Date().toISOString();
      const updates: Partial<SecurityIncident> = {
        investigationFindings: String(investigationFindings).trim(),
        investigationSubmittedAt: submittedAt,
        workflowStage: 'Pending Approval'
      };
      await IncidentModel.update(id, updates);
      await recordEvent(id, 'FINDINGS_SUBMITTED', 'Pending Approval', user,
        incident.returnCount ? `Field investigation findings resubmitted for approval (revision ${Number(incident.returnCount) + 1})` : 'Field investigation findings submitted for approval');
      await audit(user, 'UPDATE', id, `Submitted investigation findings for ${incident.refNo}`);

      await (async () => {
        const templates = await ConfigService.getNotificationTemplates();
        const template = templates.investigation_submitted;
        if (!template) return;
        const rendered = ConfigService.renderTemplate(template, {
          refNo: incident.refNo,
          investigator: user.displayName
        });
        await notifyRole('security_director', rendered.title, rendered.message, caseLink(id));
      })();

      await notifyReporterOfProgress(incident, user,
        `The field investigation for your incident ${incident.refNo} has been completed and submitted to the Chief Security Director for approval.`);

      ResponseView.sendSuccess(res, { ...incident, ...updates }, 'Investigation submitted for approval');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to submit investigation');
    }
  },

  /** Director approves the investigation or returns it to the investigator (the cycle repeats). */
  async approvalDecision(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const { decision, notes } = req.body || {};

      if (!['approve', 'return'].includes(decision)) {
        return ResponseView.sendError(res, "decision must be 'approve' or 'return'", 'Validation failed', 400);
      }
      if (decision === 'return' && (!notes || !String(notes).trim())) {
        return ResponseView.sendError(res, 'A reason is required when returning an investigation', 'Validation failed', 400);
      }

      const incident = await IncidentModel.getById(id);
      if (!incident) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }
      if ((incident.workflowStage || '') !== 'Pending Approval') {
        return ResponseView.sendError(res, `Only cases pending approval can be decided (current stage: ${incident.workflowStage})`, 'Validation failed', 400);
      }

      const decidedAt = new Date().toISOString();

      if (decision === 'return') {
        const updates: Partial<SecurityIncident> = {
          workflowStage: 'Investigation',
          returnReason: String(notes).trim(),
          returnCount: (Number(incident.returnCount) || 0) + 1,
          responsiblePerson: incident.assignedInvestigator || incident.responsiblePerson
        };
        await IncidentModel.update(id, updates);
        await recordEvent(id, 'RETURNED', 'Investigation', user, `Investigation returned to ${incident.assignedInvestigator || 'the investigator'}. Reason: ${String(notes).trim()}`);
        await audit(user, 'UPDATE', id, `Returned investigation for ${incident.refNo}`);

        const users = await UserModel.getAll();
        const investigator = users.find(u => u.displayName === incident.assignedInvestigator);
        if (investigator) {
          await notifyFromTemplate('case_returned', {
            refNo: incident.refNo,
            director: user.displayName,
            reason: String(notes).trim()
          }, [investigator.username], caseLink(id));
        }

        await notifyReporterOfProgress(incident, user,
          `The Chief Security Director has requested further field investigation on your incident ${incident.refNo} before approval.`);

        return ResponseView.sendSuccess(res, { ...incident, ...updates }, 'Investigation returned to the investigator');
      }

      // approve — hand the case back to the provincial coordinator for closure
      const effectiveCoordinators = await LeaveService.getEffectiveCoordinatorsForProvince(incident.province);
      const backToCoordinator =
        (incident.escalatedBy && effectiveCoordinators.find(c => c.displayName === incident.escalatedBy)) ||
        (effectiveCoordinators.length === 1 ? effectiveCoordinators[0] : null);

      const updates: Partial<SecurityIncident> = {
        workflowStage: 'Approved',
        approvedBy: user.displayName,
        approvedAt: decidedAt,
        approvalNotes: notes ? String(notes).trim() : '',
        responsiblePerson: backToCoordinator ? backToCoordinator.displayName : 'Unassigned'
      };
      await IncidentModel.update(id, updates);
      await recordEvent(id, 'APPROVED', 'Approved', user,
        `Investigation approved${notes ? `. Notes: ${String(notes).trim()}` : ''}. Case handed to ${updates.responsiblePerson} for closure.`);
      await audit(user, 'UPDATE', id, `Approved investigation for ${incident.refNo}`);

      const approvedVars = { refNo: incident.refNo, director: user.displayName };
      await notifyFromTemplate('case_approved', approvedVars, effectiveCoordinators.map(c => c.username), caseLink(id));
      const users = await UserModel.getAll();
      const investigator = users.find(u => u.displayName === incident.assignedInvestigator);
      if (investigator) {
        await notifyFromTemplate('case_approved', approvedVars, [investigator.username], caseLink(id));
      }

      await notifyReporterOfProgress(incident, user,
        `The investigation for your incident ${incident.refNo} has been approved by the Chief Security Director. The case is being prepared for closure.`);

      ResponseView.sendSuccess(res, { ...incident, ...updates }, 'Investigation approved');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to record approval decision');
    }
  }
};
