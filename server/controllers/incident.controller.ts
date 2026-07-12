import { Response } from 'express';
import { IncidentModel } from '../models/incident.model.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { AuditService } from '../security/audit.service.js';
import { SlaService } from '../security/sla.service.js';
import { ROLE_USERS, isNationalRole, isProvincialRole } from '../security/roleAccess.js';
import { LeaveService } from '../services/leave.service.js';
import { NotificationService } from '../services/notification.service.js';
import { ConfigService } from '../services/config.service.js';
import { CaseEventModel } from '../models/caseEvent.model.js';
import { UserModel } from '../models/user.model.js';
import { notifyReporterOfProgress } from './caseWorkflow.controller.js';

// Workflow: significant/big cases are escalated to the role configured in the
// escalation matrix (default: the Chief Security Director), who then
// assigns a Security Investigator for field work.
const getEscalationTarget = (notifyRole: string) => {
  return ROLE_USERS.find(u => u.role === notifyRole);
};

export const IncidentController = {
  async getDashboardSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let incidents = await IncidentModel.getAll();

      // Scoping incidents
      if (user.role === 'security_coordinator') {
        incidents = incidents.filter(i => i.province === user.province || i.province === 'National');
      } else if (user.role === 'employee') {
        incidents = incidents.filter(i =>
          i.ownerId === user.username || i.reportedBy === user.displayName || i.contactDetails === user.email
        );
      } else if (user.role === 'chief_security_investigator') {
        incidents = incidents.filter(i =>
          i.responsiblePerson === user.displayName || i.assignedInvestigator === user.displayName
        );
      }

      // Scoping TRA audits
      const { TraAuditModel } = await import('../models/traAudit.model.js');
      let traAudits = await TraAuditModel.getAll();
      
      if (user.role !== 'system_administrator' && !isNationalRole(user.role)) {
        if (isProvincialRole(user.role)) {
          const users = await UserModel.getAll();
          const provinceUsernames = new Set(
            users.filter(u => u.province === user.province).map(u => u.username)
          );
          traAudits = traAudits.filter(r => !r.ownerId || provinceUsernames.has(r.ownerId));
        } else {
          traAudits = traAudits.filter(r => r.ownerId === user.username);
        }
      }

      const totalIncidents = incidents.length;
      const openIncidents = incidents.filter(
        i => i.status === 'Open' || i.workflowStage === 'Submitted' || i.workflowStage === 'Under Review'
      ).length;
      const escalatedIncidents = incidents.filter(
        i => i.isEscalated || i.workflowStage === 'Escalated'
      ).length;
      const traRecordsCount = traAudits.length > 0 ? traAudits.length : 1;

      const summary = {
        roleLabel: user.role,
        province: user.province || 'Gauteng',
        totalIncidents,
        openIncidents,
        escalatedIncidents,
        traRecordsCount
      };

      ResponseView.sendSuccess(res, summary, 'Dashboard summary calculated successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to generate dashboard summary');
    }
  },

  async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let incidents = await IncidentModel.getAll();

      // Provincial Segregation (RBAC & MISS compliance, FR-033)
      if (user.role === 'security_coordinator') {
        incidents = incidents.filter(i => i.province === user.province || i.province === 'National');
      } else if (user.role === 'employee') {
        // Employees only see incidents they reported themselves.
        // ownerId is authoritative; name/email matching kept for pre-migration records
        incidents = incidents.filter(i =>
          i.ownerId === user.username || i.reportedBy === user.displayName || i.contactDetails === user.email
        );
      } else if (user.role === 'chief_security_investigator') {
        // Chief Investigator only sees cases assigned to them by the Chief Security Director
        // (assignedInvestigator keeps history visible once the case moves to approval/closure)
        incidents = incidents.filter(i =>
          i.responsiblePerson === user.displayName || i.assignedInvestigator === user.displayName
        );
      }
      // Chief Security Director and Deputy Director (national roles) see all incidents across provinces

      // Attach dynamic SLA status to each incident (targets from system configuration, FR-037)
      const slaRules = await ConfigService.getSlaRules();
      const enrichedIncidents = incidents.map(inc => ({
        ...inc,
        slaInfo: SlaService.calculateSla(inc, slaRules)
      }));

      await AuditService.log({
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username,
        userRole: user.role,
        province: user.province,
        action: 'READ',
        resource: 'Incidents List',
        details: `Fetched ${enrichedIncidents.length} incidents (Scoped for ${user.province})`,
        clearanceLevel: user.clearanceLevel
      });

      ResponseView.sendSuccess(res, enrichedIncidents, 'Fetched incidents successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch incidents');
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const incident = req.body;
      
      if (!incident.id || !incident.refNo) {
        return ResponseView.sendError(res, 'Missing incident ID or Reference Number', 'Validation failed', 400);
      }

      // Auto-populate reporter info if missing
      if (user.role === 'employee' || user.role === 'system_administrator') {
        incident.reportedBy = user.displayName;
        incident.contactDetails = user.email;
      } else if (!incident.reportedBy) {
        incident.reportedBy = user.displayName;
      }
      if (!incident.province) {
        incident.province = user.province;
      }
      // Record ownership is always stamped from the authenticated identity, never from the client
      incident.ownerId = user.username;
      // Every new report enters the workflow at the start, regardless of client payload
      incident.workflowStage = 'Submitted';

      // Auto-route to the province's effective coordinator (FR-006). A coordinator
      // on approved leave is replaced in this pool by their acting substitute, so
      // new incidents during the leave go to the leave cover automatically.
      const provinceCoordinators = await LeaveService.getEffectiveCoordinatorsForProvince(incident.province);

      if (provinceCoordinators.length === 1) {
        // Automatically assign to the single effective coordinator
        incident.responsiblePerson = provinceCoordinators[0].displayName;
      } else {
        // Leave unassigned for manual assignment if there are 0 or 2+ coordinators
        incident.responsiblePerson = 'Unassigned';
      }

      const success = await IncidentModel.create(incident);
      if (success) {
        await AuditService.log({
          timestamp: new Date().toISOString(),
          userId: user.id,
          username: user.username,
          userRole: user.role,
          province: user.province,
          action: 'CREATE',
          resource: 'Incident',
          resourceId: incident.id,
          details: `Created security incident ${incident.refNo} (${incident.classification})`,
          clearanceLevel: user.clearanceLevel
        });

        // Workflow timeline entry (FR-010)
        await CaseEventModel.record({
          incidentId: incident.id,
          eventType: 'SUBMITTED',
          stage: 'Submitted',
          actor: user.username,
          actorName: user.displayName,
          actorRole: user.role,
          notes: `Incident ${incident.refNo} submitted and auto-routed to ${incident.responsiblePerson === 'Unassigned' ? `the ${incident.province} coordinator pool` : incident.responsiblePerson}`
        });

        const templates = await ConfigService.getNotificationTemplates();
        const caseLink = `#/case/${incident.id}`;

        // Notify the routed coordinator(s) via the configurable template (FR-006/FR-008)
        const reportedTemplate = templates.incident_reported;
        if (reportedTemplate) {
          const rendered = ConfigService.renderTemplate(reportedTemplate, {
            refNo: incident.refNo,
            classification: incident.classification || 'Unclassified',
            province: incident.province,
            reportedBy: incident.reportedBy || user.displayName
          });
          await NotificationService.notifyMany(
            provinceCoordinators.map(c => c.username),
            rendered.title,
            rendered.message,
            caseLink
          );

          // FR-007: the national office (Chief Security Director) is notified of ALL incidents
          const allUsers = await UserModel.getAll();
          await NotificationService.notifyMany(
            allUsers.filter(u => u.role === 'security_director').map(u => u.username),
            rendered.title,
            rendered.message,
            caseLink
          );
        }

        // Confirmation back to the reporter — email + in-app with the reference number (FR-008)
        const confirmationTemplate = templates.incident_confirmation;
        if (confirmationTemplate) {
          const rendered = ConfigService.renderTemplate(confirmationTemplate, {
            refNo: incident.refNo,
            province: incident.province,
            natureOfCase: incident.natureOfCase || 'not specified'
          });
          await NotificationService.notify(user.username, rendered.title, rendered.message, caseLink);
        }

        ResponseView.sendSuccess(res, incident, 'Created incident successfully', 201);
      } else {
        ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to create incident');
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const updates = req.body;

      const existing = await IncidentModel.getById(id);
      if (!existing) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }

      if (user.role === 'security_coordinator') {
        const isOwnProvince = existing.province === user.province;
        const isAssignedToCoordinator =
          existing.responsiblePerson === user.displayName ||
          !existing.responsiblePerson ||
          existing.responsiblePerson === 'Unassigned';

        if (!isOwnProvince || !isAssignedToCoordinator) {
          return ResponseView.sendError(res, 'Access denied for this incident', 'Forbidden', 403);
        }
      }

      if (user.role === 'chief_security_investigator' && existing.responsiblePerson !== user.displayName) {
        return ResponseView.sendError(res, 'Access denied for this incident', 'Forbidden', 403);
      }

      if (updates.province && user.role !== 'security_director' && updates.province !== existing.province) {
        return ResponseView.sendError(res, 'Only the Chief Security Director may transfer an incident across provinces', 'Forbidden', 403);
      }
      
      const success = await IncidentModel.update(id, updates);
      if (success) {
        await AuditService.log({
          timestamp: new Date().toISOString(),
          userId: user.id,
          username: user.username,
          userRole: user.role,
          province: user.province,
          action: 'UPDATE',
          resource: 'Incident',
          resourceId: id,
          details: `Updated incident fields: ${Object.keys(updates).join(', ')}`,
          clearanceLevel: user.clearanceLevel
        });

        // Responsible-coordinator change (e.g. "Assign to Me" on an unassigned case):
        // record it on the case timeline and notify the reporter + Chief Security Director (FR-008/FR-010)
        const newResponsible = typeof updates.responsiblePerson === 'string' ? updates.responsiblePerson.trim() : '';
        const assignmentChanged =
          !!newResponsible &&
          newResponsible !== 'Unassigned' &&
          newResponsible !== existing.responsiblePerson;
        if (assignmentChanged) {
          await CaseEventModel.record({
            incidentId: id,
            eventType: 'COORDINATOR_ASSIGNED',
            stage: existing.workflowStage || 'Submitted',
            actor: user.username,
            actorName: user.displayName,
            actorRole: user.role,
            notes: `${user.displayName} assigned case ${existing.refNo} to ${newResponsible}`
          });

          await notifyReporterOfProgress(existing, user,
            `Your incident ${existing.refNo} has been assigned to ${newResponsible} (${existing.province} Security Coordinator) for preliminary review.`);

          const templates = await ConfigService.getNotificationTemplates();
          const template = templates.case_assignment_update;
          if (template) {
            const rendered = ConfigService.renderTemplate(template, {
              refNo: existing.refNo,
              province: existing.province,
              coordinator: newResponsible,
              actor: user.displayName
            });
            const allUsers = await UserModel.getAll();
            const directors = allUsers
              .filter(u => u.role === 'security_director' && u.username !== user.username)
              .map(u => u.username);
            await NotificationService.notifyMany(directors, rendered.title, rendered.message, `#/case/${id}`);
          }
        }

        ResponseView.sendSuccess(res, updates, 'Updated incident successfully');
      } else {
        ResponseView.sendError(res, 'Incident not found or no changes made', 'Operation failed', 404);
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to update incident');
    }
  },

  async escalate(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const { escalationLevel, escalationReason, escalationNotes } = req.body;

      if (!escalationLevel || !escalationReason) {
        return ResponseView.sendError(res, 'Escalation level and reason are required', 'Validation failed', 400);
      }

      // Escalation matrix (FR-037): only levels configured by the System Administrator are accepted
      const escalationRules = await ConfigService.getEscalationRules();
      if (!escalationRules.levels.includes(escalationLevel)) {
        return ResponseView.sendError(
          res,
          `Unknown escalation level '${escalationLevel}'. Configured levels: ${escalationRules.levels.join(', ')}`,
          'Validation failed',
          400
        );
      }

      const existing = await IncidentModel.getById(id);
      if (!existing) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }

      if (existing.status === 'Closed') {
        return ResponseView.sendError(res, 'Closed incidents cannot be escalated', 'Validation failed', 400);
      }

      if (existing.workflowStage === 'Escalated') {
        return ResponseView.sendError(
          res,
          `Case ${existing.refNo} has already been escalated to ${existing.escalatedTo || 'the national office'} and is awaiting action`,
          'Validation failed',
          400
        );
      }

      if (user.role === 'security_coordinator') {
        const isOwnProvince = existing.province === user.province;
        const isAssignedToCoordinator =
          existing.responsiblePerson === user.displayName ||
          !existing.responsiblePerson ||
          existing.responsiblePerson === 'Unassigned';

        if (!isOwnProvince || !isAssignedToCoordinator) {
          return ResponseView.sendError(res, 'Access denied for this incident', 'Forbidden', 403);
        }
      }

      const escalationTarget = getEscalationTarget(escalationRules.notifyRole);
      if (!escalationTarget) {
        return ResponseView.sendError(res, 'No national escalation target is configured', 'Configuration error', 500);
      }

      const escalatedAt = new Date().toISOString();
      const escalationSummary = [
        existing.outcomeOfInvestigation || '',
        `[Escalated ${escalatedAt}] ${user.displayName} escalated to ${escalationTarget.displayName}. Level: ${escalationLevel}. Reason: ${escalationReason}.${escalationNotes ? ` Notes: ${escalationNotes}` : ''}`
      ].filter(Boolean).join('\n\n');

      const updates = {
        status: 'Under Investigation' as const,
        workflowStage: 'Escalated' as const,
        responsiblePerson: escalationTarget.displayName,
        isEscalated: 1,
        escalationLevel,
        escalationReason,
        escalationNotes: escalationNotes || '',
        escalatedBy: user.displayName,
        escalatedTo: escalationTarget.displayName,
        escalatedAt,
        outcomeOfInvestigation: escalationSummary
      };

      const success = await IncidentModel.update(id, updates);
      if (success) {
        await CaseEventModel.record({
          incidentId: id,
          eventType: 'ESCALATED',
          stage: 'Escalated',
          actor: user.username,
          actorName: user.displayName,
          actorRole: user.role,
          notes: `Escalated to ${escalationTarget.displayName} (${escalationLevel}). Reason: ${escalationReason}.${escalationNotes ? ` Notes: ${escalationNotes}` : ''}`
        });

        await AuditService.log({
          timestamp: escalatedAt,
          userId: user.id,
          username: user.username,
          userRole: user.role,
          province: user.province,
          action: 'ESCALATE',
          resource: 'Incident',
          resourceId: id,
          details: `Escalated ${existing.refNo} to ${escalationTarget.displayName}. Level: ${escalationLevel}. Reason: ${escalationReason}`,
          clearanceLevel: user.clearanceLevel
        });

        // Notify the escalation target via the configurable template (FR-018/FR-038)
        const templates = await ConfigService.getNotificationTemplates();
        const escalatedTemplate = templates.incident_escalated;
        if (escalatedTemplate) {
          const rendered = ConfigService.renderTemplate(escalatedTemplate, {
            refNo: existing.refNo,
            province: existing.province,
            level: escalationLevel,
            reason: escalationReason,
            escalatedBy: user.displayName
          });
          await NotificationService.notify(escalationTarget.username, rendered.title, rendered.message, `#/case/${id}`);
        }

        // Progress update to the original reporter (status change: Escalated)
        await notifyReporterOfProgress(existing, user,
          `Your incident ${existing.refNo} has been escalated to the Chief Security Director for national-level investigation.`);

        ResponseView.sendSuccess(
          res,
          {
            ...existing,
            ...updates,
            notificationTargets: [
              {
                userId: escalationTarget.id,
                displayName: escalationTarget.displayName,
                role: escalationTarget.role,
                email: escalationTarget.email
              }
            ]
          },
          'Incident escalated successfully'
        );
      } else {
        ResponseView.sendError(res, 'Incident not found or no changes made', 'Operation failed', 404);
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to escalate incident');
    }
  }
};
