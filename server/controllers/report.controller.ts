import { Response } from 'express';
import { BtoReportModel } from '../models/btoReport.model.js';
import { InvReportModel } from '../models/invReport.model.js';
import { QtrReportModel } from '../models/qtrReport.model.js';
import { TraAuditModel } from '../models/traAudit.model.js';
import { UserModel } from '../models/user.model.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { isNationalRole, isProvincialRole, UserProfile } from '../security/roleAccess.js';

// Provincial data segregation for report records (FR-033 / NFR-013).
// Reports carry ownerId (users.username); the owner's province determines which
// provincial officials may see the record. Legacy rows without an ownerId stay
// visible to provincial roles to avoid hiding pre-migration data.
async function scopeByOwner<T extends { ownerId?: string }>(records: T[], user: UserProfile): Promise<T[]> {
  if (isNationalRole(user.role) || user.role === 'system_administrator') return records;

  if (isProvincialRole(user.role)) {
    const users = await UserModel.getAll();
    const provinceUsernames = new Set(
      users.filter(u => u.province === user.province).map(u => u.username)
    );
    return records.filter(r => !r.ownerId || provinceUsernames.has(r.ownerId));
  }

  // Employees and any other role: own records only
  return records.filter(r => r.ownerId === user.username);
}

export const ReportController = {
  // Back To Office Reports
  async getAllBto(req: AuthenticatedRequest, res: Response) {
    try {
      const reports = await scopeByOwner(await BtoReportModel.getAll(), req.user!);
      ResponseView.sendSuccess(res, reports, 'Fetched BTO reports successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch BTO reports');
    }
  },

  async createBto(req: AuthenticatedRequest, res: Response) {
    try {
      const report = req.body;
      if (!report.id || !report.officialName) {
        return ResponseView.sendError(res, 'Missing report ID or Official Name', 'Validation failed', 400);
      }
      report.ownerId = req.user!.username;

      const success = await BtoReportModel.create(report);
      if (success) {
        ResponseView.sendSuccess(res, report, 'Created BTO report successfully', 201);
      } else {
        ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to create BTO report');
    }
  },

  // Investigation Reports
  async getAllInv(req: AuthenticatedRequest, res: Response) {
    try {
      const reports = await scopeByOwner(await InvReportModel.getAll(), req.user!);
      ResponseView.sendSuccess(res, reports, 'Fetched investigation reports successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch investigation reports');
    }
  },

  async createInv(req: AuthenticatedRequest, res: Response) {
    try {
      const report = req.body;
      if (!report.id || !report.subject) {
        return ResponseView.sendError(res, 'Missing report ID or Subject', 'Validation failed', 400);
      }
      report.ownerId = req.user!.username;

      const success = await InvReportModel.create(report);
      if (success) {
        ResponseView.sendSuccess(res, report, 'Created investigation report successfully', 201);
      } else {
        ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to create investigation report');
    }
  },

  // Quarterly Reports
  async getAllQtr(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let reports = await QtrReportModel.getAll();
      // Quarterly reports carry their own province column — segregate on it directly
      if (isProvincialRole(user.role)) {
        reports = reports.filter(r => r.province === user.province || r.province === 'National');
      } else if (!isNationalRole(user.role) && user.role !== 'system_administrator') {
        reports = reports.filter(r => r.ownerId === user.username);
      }
      ResponseView.sendSuccess(res, reports, 'Fetched quarterly reports successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch quarterly reports');
    }
  },

  async createQtr(req: AuthenticatedRequest, res: Response) {
    try {
      const report = req.body;
      if (!report.id || !report.province) {
        return ResponseView.sendError(res, 'Missing report ID or Province', 'Validation failed', 400);
      }
      report.ownerId = req.user!.username;

      const success = await QtrReportModel.create(report);
      if (success) {
        ResponseView.sendSuccess(res, report, 'Created quarterly report successfully', 201);
      } else {
        ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to create quarterly report');
    }
  },

  // TRA Audits
  async getAllTra(req: AuthenticatedRequest, res: Response) {
    try {
      const audits = await scopeByOwner(await TraAuditModel.getAll(), req.user!);
      ResponseView.sendSuccess(res, audits, 'Fetched TRA audits successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch TRA audits');
    }
  },

  async createTra(req: AuthenticatedRequest, res: Response) {
    try {
      const audit = req.body;
      if (!audit.id || !audit.officeName) {
        return ResponseView.sendError(res, 'Missing audit ID or Office Name', 'Validation failed', 400);
      }
      audit.ownerId = req.user!.username;

      const success = await TraAuditModel.create(audit);
      if (success) {
        ResponseView.sendSuccess(res, audit, 'Created TRA audit successfully', 201);
      } else {
        ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to create TRA audit');
    }
  }
};
