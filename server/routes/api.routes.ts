import express, { Response } from 'express';
import { IncidentController } from '../controllers/incident.controller.js';
import { CaseWorkflowController } from '../controllers/caseWorkflow.controller.js';
import { StatsController } from '../controllers/stats.controller.js';
import { ChecklistController } from '../controllers/checklist.controller.js';
import { ReportController } from '../controllers/report.controller.js';
import { SearchController } from '../controllers/search.controller.js';
import { AuthController } from '../controllers/auth.controller.js';
import { AdminController } from '../controllers/admin.controller.js';
import { AssistantController } from '../controllers/assistant.controller.js';
import { LeaveController } from '../controllers/leave.controller.js';
import { NotificationController } from '../controllers/notification.controller.js';
import { authenticateUser, requirePermission, AuthenticatedRequest } from '../security/auth.middleware.js';
import { AuditService } from '../security/audit.service.js';
import { ResponseView } from '../views/response.view.js';

const router = express.Router();

// Apply global identity extraction middleware
router.use(authenticateUser);

// Authentication & RBAC Public / General Endpoints
router.post('/auth/login', AuthController.login);
router.post('/auth/logout', AuthController.logout);
router.post('/auth/refresh-token', AuthController.refreshToken);
router.get('/auth/profile', requirePermission('dashboard:view'), AuthController.profile);
// Self-service profile management (contact details, notification preferences, portal credential, own audit trail)
router.put('/auth/profile', requirePermission('dashboard:view'), AuthController.updateProfile);
router.put('/auth/preferences', requirePermission('dashboard:view'), AuthController.updatePreferences);
router.post('/auth/change-password', requirePermission('dashboard:view'), AuthController.changePassword);
router.get('/auth/my-activity', requirePermission('dashboard:view'), AuthController.myActivity);
router.get('/auth/permissions', requirePermission('dashboard:view'), AuthController.permissions);
router.get('/users', requirePermission('admin:manage_roles'), AuthController.users);
// User account management (FR-036 — System Administrator / Chief Security Director)
router.post('/users', requirePermission('admin:manage_roles'), AdminController.createUser);
router.put('/users/:username/details', requirePermission('admin:manage_roles'), AdminController.updateUser);
router.put('/users/:username/active', requirePermission('admin:manage_roles'), AdminController.setUserActive);
// Temporary Security Coordinator management (Chief Security Director only — leave cover, matrix item 2)
router.post('/users/:username/temp-coordinator', requirePermission('admin:manage_roles'), AuthController.assignTempCoordinator);
router.delete('/users/:username/temp-coordinator', requirePermission('admin:manage_roles'), AuthController.revokeTempCoordinator);
router.get('/roles', requirePermission('admin:manage_roles'), AuthController.roles);
router.get('/permissions', requirePermission('admin:manage_roles'), AuthController.allPermissions);

// System configuration & monitoring (FR-037–FR-040 — System Administrator)
router.get('/config/form-options', requirePermission('dashboard:view'), AdminController.formOptions);
router.get('/admin/config', requirePermission('admin:system_config'), AdminController.getConfig);
router.put('/admin/config/:key', requirePermission('admin:system_config'), AdminController.updateConfig);
router.get('/admin/system-health', requirePermission('admin:system_config'), AdminController.systemHealth);

// Audit Trail Logs (Compliance Monitoring)
router.get('/audit-logs', requirePermission('admin:manage_roles'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await AuditService.getRecentLogs(100);
    ResponseView.sendSuccess(res, logs, 'Fetched audit logs successfully');
  } catch (err) {
    ResponseView.sendError(res, err as any, 'Failed to fetch audit logs');
  }
});

// Incidents CRUD (Protected by RBAC)
router.get('/incidents', requirePermission('dashboard:view'), IncidentController.getAll);
router.post('/incidents', requirePermission('incident:create'), IncidentController.create);
router.post('/incidents/:id/escalate', requirePermission('case:escalate'), IncidentController.escalate);
router.put('/incidents/:id', requirePermission('incident:update'), IncidentController.update);

// End-to-end case workflow (process-flow document: review -> close/escalate ->
// assign investigator -> field findings -> approve/return -> close -> notify reporter).
// Record-level access is enforced inside the controller on top of these permissions.
router.get('/incidents/:id', requirePermission('dashboard:view'), CaseWorkflowController.getDetail);
router.post('/incidents/:id/attachments', requirePermission('dashboard:view'), CaseWorkflowController.uploadAttachment);
router.get('/incidents/:id/attachments/:attachmentId/download', requirePermission('dashboard:view'), CaseWorkflowController.downloadAttachment);
router.post('/incidents/:id/review', requirePermission('case:approve'), CaseWorkflowController.startReview);
router.put('/incidents/:id/preliminary', requirePermission('case:approve'), CaseWorkflowController.savePreliminaryFindings);
router.post('/incidents/:id/close', requirePermission('case:close'), CaseWorkflowController.closeCase);
router.get('/investigators', requirePermission('case:assign_investigator'), CaseWorkflowController.listInvestigators);
router.post('/incidents/:id/assign-investigator', requirePermission('case:assign_investigator'), CaseWorkflowController.assignInvestigator);
router.post('/incidents/:id/submit-investigation', requirePermission('investigation:submit'), CaseWorkflowController.submitInvestigation);
router.post('/incidents/:id/approval-decision', requirePermission('investigation:approve'), CaseWorkflowController.approvalDecision);

// Performance Statistics
router.get('/stats', requirePermission('dashboard:view'), StatsController.getAll);
router.put('/stats', requirePermission('reports:submit_operational'), StatsController.updateBulk);

// Operational Checklists
router.get('/checklists', requirePermission('dashboard:view'), ChecklistController.getAll);
router.put('/checklists', requirePermission('reports:submit_operational'), ChecklistController.updateBulk);

// Document Submissions & Reports
router.get('/bto-reports', requirePermission('reports:view_archive'), ReportController.getAllBto);
router.post('/bto-reports', requirePermission('reports:submit_operational'), ReportController.createBto);

router.get('/investigation-reports', requirePermission('reports:view_archive'), ReportController.getAllInv);
router.post('/investigation-reports', requirePermission('investigation:submit'), ReportController.createInv);

router.get('/quarterly-reports', requirePermission('reports:view_archive'), ReportController.getAllQtr);
router.post('/quarterly-reports', requirePermission('reports:submit_operational'), ReportController.createQtr);

router.get('/tra-audits', requirePermission('reports:view_archive'), ReportController.getAllTra);
router.post('/tra-audits', requirePermission('reports:submit_operational'), ReportController.createTra);

router.get('/search', requirePermission('dashboard:view'), SearchController.search);

// Leave Management (coordinator request/calendar + Chief Security Director review)
router.get('/leaves/mine', requirePermission('leave:request'), LeaveController.mine);
router.post('/leaves', requirePermission('leave:request'), LeaveController.request);
router.put('/leaves/days/:dayId/cancel', requirePermission('leave:request'), LeaveController.cancel);
router.get('/leaves', requirePermission('leave:review'), LeaveController.getAll);
router.get('/leaves/:batchId/substitutes', requirePermission('leave:review'), LeaveController.substitutes);
router.put('/leaves/:batchId/decide', requirePermission('leave:review'), LeaveController.decide);
router.put('/leaves/days/:dayId/revoke', requirePermission('leave:review'), LeaveController.revoke);
// Coordinator leave allocation (Chief Security Director > coordinator profile management)
router.put('/users/:username/leave-allocation', requirePermission('leave:manage_allocation'), LeaveController.updateAllocation);

// In-app notifications (FR-008) — each user sees only their own feed
router.get('/notifications', requirePermission('dashboard:view'), NotificationController.list);
router.put('/notifications/read-all', requirePermission('dashboard:view'), NotificationController.markAllRead);
router.put('/notifications/:id/read', requirePermission('dashboard:view'), NotificationController.markRead);

// SIMS Assistant (AI) — conversations are not persisted; data access is tool-scoped per user
router.post('/assistant', requirePermission('dashboard:view'), AssistantController.chat);

export default router;
