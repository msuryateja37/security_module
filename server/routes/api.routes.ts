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
import { parsePagination } from '../utils/pagination.js';

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
// Self-service profile photo (any authenticated role) — upload/replace and retrieve own avatar
router.put('/auth/avatar', requirePermission('dashboard:view'), AuthController.updateAvatar);
router.get('/auth/avatar', requirePermission('dashboard:view'), AuthController.getAvatar);
router.put('/auth/preferences', requirePermission('dashboard:view'), AuthController.updatePreferences);
router.post('/auth/change-password', requirePermission('dashboard:view'), AuthController.changePassword);
router.get('/auth/my-activity', requirePermission('dashboard:view'), AuthController.myActivity);
router.get('/auth/permissions', requirePermission('dashboard:view'), AuthController.permissions);
// Employee directory lookup for the incident form ("Report For: Others" tagging) — minimal fields only
router.get('/users/lookup', requirePermission('incident:create'), AuthController.lookupUsers);
router.get('/users', requirePermission('admin:manage_roles'), AuthController.users);
// User account management (FR-036 — System Administrator / Chief Security Director)
router.post('/users', requirePermission('admin:manage_roles'), AdminController.createUser);
router.put('/users/:username/details', requirePermission('admin:manage_roles'), AdminController.updateUser);
router.put('/users/:username/active', requirePermission('admin:manage_roles'), AdminController.setUserActive);
// Admin management of another account's profile photo (view/replace) on the user profile page
router.get('/users/:username/avatar', requirePermission('admin:manage_roles'), AuthController.getUserAvatar);
router.put('/users/:username/avatar', requirePermission('admin:manage_roles'), AuthController.updateUserAvatar);
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
    const pageParams = parsePagination(req.query);
    if (pageParams) {
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const { data, total } = await AuditService.getPaginated({ ...pageParams, search });
      const totalPages = Math.max(1, Math.ceil(total / pageParams.pageSize));
      return ResponseView.sendPaginated(
        res,
        { data, page: Math.min(pageParams.page, totalPages), pageSize: pageParams.pageSize, total, totalPages },
        'Fetched audit logs page successfully'
      );
    }
    const logs = await AuditService.getRecentLogs(100);
    ResponseView.sendSuccess(res, logs, 'Fetched audit logs successfully');
  } catch (err) {
    ResponseView.sendError(res, err as any, 'Failed to fetch audit logs');
  }
});

// Incidents CRUD (Protected by RBAC)
router.get('/dashboard/summary', requirePermission('dashboard:view'), IncidentController.getDashboardSummary);
router.get('/incidents', requirePermission('dashboard:view'), IncidentController.getAll);
router.post('/incidents', requirePermission('incident:create'), IncidentController.create);
router.put('/incidents/:id', requirePermission('incident:update'), IncidentController.update);

// End-to-end case workflow (process-flow document: review -> close/escalate ->
// assign investigator -> field findings -> approve/return -> close -> notify reporter).
// Record-level access is enforced inside the controller on top of these permissions.
router.get('/incidents/:id', requirePermission('dashboard:view'), CaseWorkflowController.getDetail);
// Evidence staged from the report form before the case exists, then linked on submit
router.post('/uploads/staged', requirePermission('incident:create'), CaseWorkflowController.uploadStaged);
router.post('/incidents/:id/attachments/link-staged', requirePermission('dashboard:view'), CaseWorkflowController.linkStagedAttachments);
router.post('/incidents/:id/attachments', requirePermission('dashboard:view'), CaseWorkflowController.uploadAttachment);
router.get('/incidents/:id/attachments/:attachmentId/download', requirePermission('dashboard:view'), CaseWorkflowController.downloadAttachment);
router.post('/incidents/:id/comments', requirePermission('dashboard:view'), CaseWorkflowController.addComment);
router.post('/incidents/:id/review', requirePermission('case:approve'), CaseWorkflowController.startReview);
router.put('/incidents/:id/preliminary', requirePermission('case:approve'), CaseWorkflowController.savePreliminaryFindings);
router.post('/incidents/:id/close', requirePermission('case:close'), CaseWorkflowController.closeCase);
// Deputy Director review chain (v2): coordinator submits -> DD verifies & recommends -> director decides
router.post('/incidents/:id/submit-to-dd', requirePermission('case:approve'), CaseWorkflowController.submitToDeputyDirector);
router.post('/incidents/:id/dd-review', requirePermission('investigation:verify'), CaseWorkflowController.ddReview);
router.get('/investigators', requirePermission('case:assign_investigator'), CaseWorkflowController.listInvestigators);
router.post('/incidents/:id/assign-investigator', requirePermission('case:assign_investigator'), CaseWorkflowController.assignInvestigator);
// Director / Deputy Director route an unassigned incident to a Security Coordinator
router.get('/incidents/:id/assignable-coordinators', requirePermission('case:assign_coordinator'), CaseWorkflowController.listAssignableCoordinators);
router.post('/incidents/:id/assign-coordinator', requirePermission('case:assign_coordinator'), CaseWorkflowController.assignCoordinator);
router.post('/incidents/:id/submit-investigation', requirePermission('investigation:submit'), CaseWorkflowController.submitInvestigation);
router.post('/incidents/:id/approval-decision', requirePermission('investigation:approve'), CaseWorkflowController.approvalDecision);
// Investigation time extension: coordinator/investigator requests; Director/Deputy Director decides.
// Requester role/window is enforced in the controller (gated on dashboard:view like comments/uploads);
// the decision endpoint uses investigation:verify, which both the Director and Deputy Director hold.
router.post('/incidents/:id/request-extension', requirePermission('dashboard:view'), CaseWorkflowController.requestExtension);
router.post('/incidents/:id/extension-decision', requirePermission('investigation:verify'), CaseWorkflowController.decideExtension);

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
// Digital signature (email-PIN) for TRA sign-off. Gated on the broad archive-view
// permission so both assessors (coordinators) and managers (national roles) qualify;
// the manager-sign endpoint additionally enforces role + ownership in the controller.
router.post('/tra-audits/sign/request-otp', requirePermission('reports:view_archive'), ReportController.requestSignOtp);
router.post('/tra-audits/sign/verify-otp', requirePermission('reports:view_archive'), ReportController.verifySignOtp);
router.post('/tra-audits/:id/manager-sign', requirePermission('reports:view_archive'), ReportController.managerSignTra);

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
