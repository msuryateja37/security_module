import express, { Response } from 'express';
import { IncidentController } from '../controllers/incident.controller.js';
import { StatsController } from '../controllers/stats.controller.js';
import { ChecklistController } from '../controllers/checklist.controller.js';
import { ReportController } from '../controllers/report.controller.js';
import { SearchController } from '../controllers/search.controller.js';
import { AuthController } from '../controllers/auth.controller.js';
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
router.get('/auth/permissions', requirePermission('dashboard:view'), AuthController.permissions);
router.get('/users', requirePermission('admin:manage_roles'), AuthController.users);
router.get('/roles', requirePermission('admin:manage_roles'), AuthController.roles);
router.get('/permissions', requirePermission('admin:manage_roles'), AuthController.allPermissions);

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

export default router;
