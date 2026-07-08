import fs from 'fs';
import path from 'path';

// Physical storage for case attachments (FR-004/FR-014). Files are written to
// uploads/<incidentId>/<attachmentId>__<sanitized-name> and never overwritten;
// the DB row (attachments table) holds the relative storagePath. Uploads
// arrive as base64 in the JSON body (see express.json limit in server/index.ts).

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file

// Document/evidence types accepted on the incident form and investigation uploads.
// Executables and scripts are rejected (MISS: uploads are evidence, not software).
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.heic',
  '.txt', '.csv', '.rtf', '.msg', '.eml', '.zip',
  '.mp4', '.mov', '.avi', '.mp3', '.wav', '.m4a'
]);

const sanitizeFileName = (name: string): string => {
  const base = path.basename(name).replace(/[^\w.\- ()]/g, '_').trim();
  return base.length > 0 ? base.slice(0, 180) : 'attachment';
};

export const FileStorageService = {
  isAllowedFileName(fileName: string): boolean {
    return ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
  },

  /**
   * Persist a base64 payload for an incident. Returns the relative storage
   * path and the decoded size in bytes. Throws on oversized payloads.
   */
  saveBase64(incidentId: string, attachmentId: string, fileName: string, base64Data: string): { storagePath: string; fileSize: number } {
    // Tolerate data-URL prefixes from FileReader.readAsDataURL
    const raw = base64Data.includes(',') ? base64Data.slice(base64Data.indexOf(',') + 1) : base64Data;
    const buffer = Buffer.from(raw, 'base64');
    if (buffer.length === 0) {
      throw new Error('Empty file payload');
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw new Error(`File exceeds the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB upload limit`);
    }

    const safeIncidentId = incidentId.replace(/[^\w\-]/g, '_');
    const dir = path.join(UPLOAD_ROOT, safeIncidentId);
    fs.mkdirSync(dir, { recursive: true });

    const storedName = `${attachmentId}__${sanitizeFileName(fileName)}`;
    fs.writeFileSync(path.join(dir, storedName), buffer);

    return {
      storagePath: path.posix.join(safeIncidentId, storedName),
      fileSize: buffer.length
    };
  },

  /** Absolute path for a stored attachment, guarded against path traversal. */
  resolve(storagePath: string): string {
    const absolute = path.resolve(UPLOAD_ROOT, storagePath);
    if (!absolute.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) {
      throw new Error('Invalid attachment path');
    }
    return absolute;
  },

  exists(storagePath: string): boolean {
    try {
      return fs.existsSync(this.resolve(storagePath));
    } catch {
      return false;
    }
  }
};
