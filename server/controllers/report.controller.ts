import { Response } from 'express';
import { BtoReportModel } from '../models/btoReport.model.js';
import { InvReportModel } from '../models/invReport.model.js';
import { QtrReportModel } from '../models/qtrReport.model.js';
import { TraAuditModel } from '../models/traAudit.model.js';
import { UserModel } from '../models/user.model.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { isNationalRole, isProvincialRole, UserProfile } from '../security/roleAccess.js';
import { parsePagination, paginate } from '../utils/pagination.js';
import { SignatureOtpService } from '../services/signatureOtp.service.js';
import { AuditService } from '../security/audit.service.js';

// Apply optional free-text search over the given fields, then respond with either
// the full array (legacy) or a single page (when ?page/?pageSize is present).
function respondList<T>(
  res: Response,
  req: AuthenticatedRequest,
  records: T[],
  searchFields: (r: T) => (string | undefined)[],
  message: string
): void {
  let list = records;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  if (search) {
    list = list.filter(r => searchFields(r).some(f => (f || '').toLowerCase().includes(search)));
  }
  const pageParams = parsePagination(req.query);
  if (pageParams) {
    ResponseView.sendPaginated(res, paginate(list, pageParams), message);
    return;
  }
  ResponseView.sendSuccess(res, list, message);
}

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
      respondList(res, req, reports, r => [r.officialName, r.eventName, r.venue, r.purpose], 'Fetched BTO reports successfully');
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
      respondList(res, req, reports, (r: any) => [r.subject, r.officerName, r.office, r.purpose], 'Fetched investigation reports successfully');
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
      respondList(res, req, reports, (r: any) => [r.province, r.program, r.branch, r.quarterNumber, r.year], 'Fetched quarterly reports successfully');
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
      respondList(res, req, audits, (r: any) => [r.officeName, r.assessorName, r.officeLocation, r.managerName], 'Fetched TRA audits successfully');
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
      // A freshly submitted checklist always awaits the manager's counter-signature.
      audit.status = 'pending_manager';

      const success = await TraAuditModel.create(audit);
      if (success) {
        ResponseView.sendSuccess(res, audit, 'Created TRA audit successfully', 201);
      } else {
        ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to create TRA audit');
    }
  },

  // Email a one-time PIN to the authenticated signer's departmental address. The
  // signer must confirm this PIN before their drawn signature is accepted.
  async requestSignOtp(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const purpose = req.body?.purpose === 'manager' ? 'manager sign-off' : 'assessor sign-off';
      const { emailed, devPin } = await SignatureOtpService.request(user.username, user.email, purpose);
      ResponseView.sendSuccess(res, { emailed, devPin, email: user.email }, 'PIN sent');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to send PIN');
    }
  },

  // Verify a PIN without persisting anything — used by the assessor, whose record
  // is only written when they submit the full checklist afterwards.
  async verifySignOtp(req: AuthenticatedRequest, res: Response) {
    try {
      const result = SignatureOtpService.verify(req.user!.username, req.body?.pin || '');
      if (result.ok) {
        return ResponseView.sendSuccess(res, { verified: true }, 'PIN verified');
      }
      return ResponseView.sendError(res, result.error, 'Verification failed', 400);
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to verify PIN');
    }
  },

  // Manager counter-signature on an existing pending record: verifies the PIN and
  // persists the manager's signature atomically, finalising the checklist.
  async managerSignTra(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const { pin, signature } = req.body || {};

      // Only supervisory (national) roles may counter-sign, and never the assessor
      // who created the record.
      if (!isNationalRole(user.role)) {
        return ResponseView.sendError(res, 'Only a manager may counter-sign a TRA checklist', 'Forbidden', 403);
      }
      if (!signature) {
        return ResponseView.sendError(res, 'Missing signature', 'Validation failed', 400);
      }

      const record = await TraAuditModel.getById(id);
      if (!record) {
        return ResponseView.sendError(res, 'TRA record not found', 'Not found', 404);
      }
      if (record.ownerId && record.ownerId === user.username) {
        return ResponseView.sendError(res, 'You cannot counter-sign a checklist you submitted', 'Forbidden', 403);
      }
      if (record.status === 'signed') {
        return ResponseView.sendError(res, 'This checklist has already been signed', 'Conflict', 409);
      }

      const otp = SignatureOtpService.verify(user.username, pin || '');
      if (!otp.ok) {
        return ResponseView.sendError(res, otp.error, 'Verification failed', 400);
      }

      const success = await TraAuditModel.signAsManager(id, signature, user.displayName);
      if (!success) {
        return ResponseView.sendError(res, 'Failed to save manager signature', 'Operation failed');
      }

      await AuditService.log({
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username,
        userRole: user.role,
        province: user.province,
        action: 'UPDATE',
        resource: 'TRA Checklist',
        resourceId: id,
        details: `Manager counter-signed TRA checklist for ${record.officeName}`,
        clearanceLevel: user.clearanceLevel
      });

      const updated = await TraAuditModel.getById(id);
      ResponseView.sendSuccess(res, updated, 'Manager signature saved');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to sign TRA checklist');
    }
  }
};
