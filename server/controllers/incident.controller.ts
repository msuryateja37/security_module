import { Response } from 'express';
import { IncidentModel } from '../models/incident.model.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { AuditService } from '../security/audit.service.js';
import { SlaService } from '../security/sla.service.js';
import { ROLE_USERS } from '../security/roleAccess.js';

const getEscalationTarget = (level?: string) => {
  if (level === 'Critical' || level === 'National Review') {
    return ROLE_USERS.find(u => u.role === 'security_director') || ROLE_USERS.find(u => u.role === 'chief_security_investigator');
  }

  return ROLE_USERS.find(u => u.role === 'chief_security_investigator') || ROLE_USERS.find(u => u.role === 'security_director');
};

export const IncidentController = {
  async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let incidents = await IncidentModel.getAll();

      // Provincial Segregation (RBAC & MISS compliance)
      // If user is not National / Director, restrict view to their authorized province or own reported incidents
      if (user.role === 'security_coordinator') {
        incidents = incidents.filter(i => i.province === user.province || i.province === 'National');
      } else if (user.role === 'employee') {
        incidents = incidents.filter(i => i.reportedBy === user.displayName || i.contactDetails === user.email);
      }

      // Attach dynamic SLA status to each incident
      const enrichedIncidents = incidents.map(inc => ({
        ...inc,
        slaInfo: SlaService.calculateSla(inc)
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
      if (user.role === 'employee') {
        incident.reportedBy = user.displayName;
        incident.contactDetails = user.email;
      } else if (!incident.reportedBy) {
        incident.reportedBy = user.displayName;
      }
      if (!incident.province) {
        incident.province = user.province;
      }

      // Count coordinators for the incident's province
      const provinceCoordinators = ROLE_USERS.filter(
        u => u.role === 'security_coordinator' && u.province === incident.province
      );

      if (provinceCoordinators.length === 1) {
        // Automatically assign to the single coordinator
        incident.responsiblePerson = provinceCoordinators[0].displayName;
      } else {
        // Leave unassigned for manual assignment if there are 2 or more coordinators
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
        return ResponseView.sendError(res, 'Only the security director may transfer an incident across provinces', 'Forbidden', 403);
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

      const existing = await IncidentModel.getById(id);
      if (!existing) {
        return ResponseView.sendError(res, 'Incident not found', 'Operation failed', 404);
      }

      if (existing.status === 'Closed') {
        return ResponseView.sendError(res, 'Closed incidents cannot be escalated', 'Validation failed', 400);
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

      const escalationTarget = getEscalationTarget(escalationLevel);
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
