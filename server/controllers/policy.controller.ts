import { Response } from 'express';
import { PolicyDocumentModel, PolicyDocument } from '../models/policyDocument.model.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { AuditService } from '../security/audit.service.js';
import { FileStorageService } from '../services/fileStorage.service.js';

// Policy Hub repository (CI-0012). Every authenticated role may read and download
// the approved policies — investigators reference them mid-case. Publishing a new
// document is restricted at the route level (policy:manage).

const audit = (req: AuthenticatedRequest, action: 'CREATE' | 'READ', resourceId: string, details: string) =>
  AuditService.log({
    timestamp: new Date().toISOString(),
    userId: req.user!.id,
    username: req.user!.username,
    userRole: req.user!.role,
    province: req.user!.province,
    action,
    resource: 'PolicyDocument',
    resourceId,
    details,
    clearanceLevel: req.user!.clearanceLevel
  });

export const PolicyController = {
  /** All policy documents, current versions first. */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const documents = await PolicyDocumentModel.getAll();
      // storagePath is an internal location — never send it to the browser
      ResponseView.sendSuccess(
        res,
        documents.map(({ storagePath: _storagePath, ...rest }) => ({ ...rest, isCurrent: !!rest.isCurrent })),
        'Fetched policy documents successfully'
      );
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch policy documents');
    }
  },

  /** Publish a policy document; a repeat title supersedes its earlier versions. */
  async upload(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { title, category, version, effectiveDate, revisionDate, summary, fileName, mimeType, dataBase64 } = req.body || {};

      if (!title || !fileName || !dataBase64) {
        return ResponseView.sendError(res, 'title, fileName and dataBase64 are required', 'Validation failed', 400);
      }
      if (!FileStorageService.isAllowedFileName(fileName)) {
        return ResponseView.sendError(res, `File type of '${fileName}' is not allowed`, 'Validation failed', 400);
      }

      const id = `pol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let stored;
      try {
        stored = await FileStorageService.savePolicyDocument(id, fileName, dataBase64, mimeType);
      } catch (err: any) {
        return ResponseView.sendError(res, err.message || 'Failed to store file', 'Validation failed', 400);
      }

      const document: PolicyDocument = {
        id,
        title: String(title).slice(0, 300),
        category: category || 'General',
        version: version || '1.0',
        effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
        revisionDate: revisionDate || '',
        summary: summary || '',
        fileName,
        mimeType: mimeType || 'application/octet-stream',
        fileSize: stored.fileSize,
        storagePath: stored.storagePath,
        uploadedBy: user.username,
        uploadedByName: user.displayName,
        isCurrent: 1,
        dateCreated: new Date().toISOString()
      };

      await PolicyDocumentModel.create(document);
      await PolicyDocumentModel.supersedePreviousVersions(document.title, id);
      await audit(req, 'CREATE', id, `Published policy "${document.title}" v${document.version}`);

      const { storagePath: _storagePath, ...safe } = document;
      ResponseView.sendSuccess(res, { ...safe, isCurrent: true }, 'Policy document published successfully', 201);
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to publish policy document');
    }
  },

  /** Stream a policy document back to any authenticated user. */
  async download(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const document = await PolicyDocumentModel.getById(id);
      if (!document) {
        return ResponseView.sendError(res, 'Policy document not found', 'Operation failed', 404);
      }
      if (!(await FileStorageService.exists(document.storagePath))) {
        return ResponseView.sendError(res, 'Stored file is missing from the document store', 'Operation failed', 410);
      }

      await audit(req, 'READ', id, `Downloaded policy "${document.title}" v${document.version}`);

      res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', document.fileSize);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName.replace(/[^\w.\- ()]/g, '_')}"`);
      const stream = await FileStorageService.openReadStream(document.storagePath);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to download policy document');
    }
  }
};
