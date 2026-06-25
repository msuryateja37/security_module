import express from 'express';
import { IncidentController } from '../controllers/incident.controller.js';
import { StatsController } from '../controllers/stats.controller.js';
import { ChecklistController } from '../controllers/checklist.controller.js';
import { ReportController } from '../controllers/report.controller.js';
import { SearchController } from '../controllers/search.controller.js';
const router = express.Router();
// Incidents CRUD
router.get('/incidents', IncidentController.getAll);
router.post('/incidents', IncidentController.create);
router.put('/incidents/:id', IncidentController.update);
// Performance Statistics
router.get('/stats', StatsController.getAll);
router.put('/stats', StatsController.updateBulk);
// Operational Checklists
router.get('/checklists', ChecklistController.getAll);
router.put('/checklists', ChecklistController.updateBulk);
// Document Submissions (Screens Docx)
router.get('/bto-reports', ReportController.getAllBto);
router.post('/bto-reports', ReportController.createBto);
router.get('/investigation-reports', ReportController.getAllInv);
router.post('/investigation-reports', ReportController.createInv);
router.get('/quarterly-reports', ReportController.getAllQtr);
router.post('/quarterly-reports', ReportController.createQtr);
router.get('/tra-audits', ReportController.getAllTra);
router.post('/tra-audits', ReportController.createTra);
router.get('/search', SearchController.search);
export default router;
