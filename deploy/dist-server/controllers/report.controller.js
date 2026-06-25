import { BtoReportModel } from '../models/btoReport.model.js';
import { InvReportModel } from '../models/invReport.model.js';
import { QtrReportModel } from '../models/qtrReport.model.js';
import { TraAuditModel } from '../models/traAudit.model.js';
import { ResponseView } from '../views/response.view.js';
export const ReportController = {
    // Back To Office Reports
    async getAllBto(req, res) {
        try {
            const reports = await BtoReportModel.getAll();
            ResponseView.sendSuccess(res, reports, 'Fetched BTO reports successfully');
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to fetch BTO reports');
        }
    },
    async createBto(req, res) {
        try {
            const report = req.body;
            if (!report.id || !report.officialName) {
                return ResponseView.sendError(res, 'Missing report ID or Official Name', 'Validation failed', 400);
            }
            const success = await BtoReportModel.create(report);
            if (success) {
                ResponseView.sendSuccess(res, report, 'Created BTO report successfully', 201);
            }
            else {
                ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
            }
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to create BTO report');
        }
    },
    // Investigation Reports
    async getAllInv(req, res) {
        try {
            const reports = await InvReportModel.getAll();
            ResponseView.sendSuccess(res, reports, 'Fetched investigation reports successfully');
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to fetch investigation reports');
        }
    },
    async createInv(req, res) {
        try {
            const report = req.body;
            if (!report.id || !report.subject) {
                return ResponseView.sendError(res, 'Missing report ID or Subject', 'Validation failed', 400);
            }
            const success = await InvReportModel.create(report);
            if (success) {
                ResponseView.sendSuccess(res, report, 'Created investigation report successfully', 201);
            }
            else {
                ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
            }
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to create investigation report');
        }
    },
    // Quarterly Reports
    async getAllQtr(req, res) {
        try {
            const reports = await QtrReportModel.getAll();
            ResponseView.sendSuccess(res, reports, 'Fetched quarterly reports successfully');
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to fetch quarterly reports');
        }
    },
    async createQtr(req, res) {
        try {
            const report = req.body;
            if (!report.id || !report.province) {
                return ResponseView.sendError(res, 'Missing report ID or Province', 'Validation failed', 400);
            }
            const success = await QtrReportModel.create(report);
            if (success) {
                ResponseView.sendSuccess(res, report, 'Created quarterly report successfully', 201);
            }
            else {
                ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
            }
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to create quarterly report');
        }
    },
    // TRA Audits
    async getAllTra(req, res) {
        try {
            const audits = await TraAuditModel.getAll();
            ResponseView.sendSuccess(res, audits, 'Fetched TRA audits successfully');
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to fetch TRA audits');
        }
    },
    async createTra(req, res) {
        try {
            const audit = req.body;
            if (!audit.id || !audit.officeName) {
                return ResponseView.sendError(res, 'Missing audit ID or Office Name', 'Validation failed', 400);
            }
            const success = await TraAuditModel.create(audit);
            if (success) {
                ResponseView.sendSuccess(res, audit, 'Created TRA audit successfully', 201);
            }
            else {
                ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
            }
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to create TRA audit');
        }
    }
};
