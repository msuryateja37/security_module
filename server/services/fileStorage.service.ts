import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

// Physical storage for case attachments (FR-004/FR-014).
//
// Two backends, selected by environment:
//  - Azure Blob Storage when AZURE_STORAGE_CONNECTION_STRING is set (production).
//    Each case gets its own virtual folder named after the case reference
//    (e.g. SEC-2026-001/att-...__site-photo.jpg) inside the container
//    AZURE_STORAGE_CONTAINER (default "case-documents"). These rows carry an
//    "azure:" prefix in storagePath so downloads know where to look.
//  - Local disk under uploads/<caseFolder>/<attachmentId>__<name> otherwise
//    (dev fallback, and how pre-migration rows were stored).
//
// Files are never overwritten or deleted (immutable evidence trail); the DB
// row (attachments table) holds storagePath. Uploads arrive as base64 in the
// JSON body (see express.json limit in server/index.ts).

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const AZURE_PREFIX = 'azure:';

export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB per profile photo

// Profile photos are the only image kinds accepted on the avatar upload path.
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.heic'
]);

// Content types keyed by extension, used to serve avatars back with the right header.
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.heic': 'image/heic'
};

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

// Case refNos look like SEC/2026/001 — slashes would nest extra folders, so
// they become dashes: one folder per case, named after the case.
const sanitizeCaseFolder = (caseRef: string): string => {
  const safe = caseRef.replace(/[\\/]/g, '-').replace(/[^\w-]/g, '_');
  return safe.length > 0 ? safe : 'case';
};

let containerReady: Promise<ContainerClient> | null = null;

const azureConfigured = (): boolean => !!process.env.AZURE_STORAGE_CONNECTION_STRING;

const getContainer = (): Promise<ContainerClient> => {
  if (!containerReady) {
    containerReady = (async () => {
      const service = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!);
      const client = service.getContainerClient(
        process.env.AZURE_STORAGE_CONTAINER_NAME || process.env.AZURE_STORAGE_CONTAINER || 'case-documents'
      );
      await client.createIfNotExists();
      return client;
    })();
    // Allow a retry on transient startup failure instead of caching the rejection
    containerReady.catch(() => { containerReady = null; });
  }
  return containerReady;
};

const decodeBase64 = (base64Data: string, maxBytes: number = MAX_FILE_BYTES): Buffer => {
  // Tolerate data-URL prefixes from FileReader.readAsDataURL
  const raw = base64Data.includes(',') ? base64Data.slice(base64Data.indexOf(',') + 1) : base64Data;
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length === 0) {
    throw new Error('Empty file payload');
  }
  if (buffer.length > maxBytes) {
    throw new Error(`File exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB upload limit`);
  }
  return buffer;
};

// Avatars live under one folder per user, named by the (sanitised) username.
const sanitizeUserFolder = (username: string): string => {
  const safe = username.replace(/[^\w.-]/g, '_');
  return safe.length > 0 ? safe : 'user';
};

const resolveLocal = (storagePath: string): string => {
  const absolute = path.resolve(UPLOAD_ROOT, storagePath);
  if (!absolute.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) {
    throw new Error('Invalid attachment path');
  }
  return absolute;
};

export const FileStorageService = {
  isAllowedFileName(fileName: string): boolean {
    return ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
  },

  isAllowedImageName(fileName: string): boolean {
    return ALLOWED_IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
  },

  /** Best-guess content type from a stored path's extension (used to serve avatars back). */
  contentTypeFor(storagePath: string): string {
    return IMAGE_MIME_BY_EXT[path.extname(storagePath).toLowerCase()] || 'application/octet-stream';
  },

  /**
   * Persist a profile photo for a user. Unlike case evidence, avatars are
   * replaceable — each upload writes a fresh timestamped blob under
   * avatars/<username>/ and the DB row keeps only the latest storagePath.
   * Returns the storagePath to record and the decoded size in bytes.
   */
  async saveAvatar(username: string, fileName: string, base64Data: string, mimeType?: string): Promise<{ storagePath: string; fileSize: number }> {
    const buffer = decodeBase64(base64Data, MAX_AVATAR_BYTES);
    const folder = `avatars/${sanitizeUserFolder(username)}`;
    const storedName = `${Date.now()}__${sanitizeFileName(fileName)}`;

    if (azureConfigured()) {
      const container = await getContainer();
      const blobName = `${folder}/${storedName}`;
      await container.getBlockBlobClient(blobName).uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: mimeType || this.contentTypeFor(fileName) }
      });
      return { storagePath: `${AZURE_PREFIX}${blobName}`, fileSize: buffer.length };
    }

    const dir = path.join(UPLOAD_ROOT, folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, storedName), buffer);
    return { storagePath: path.posix.join(folder, storedName), fileSize: buffer.length };
  },

  /**
   * Persist a base64 payload for a case. caseRef names the per-case folder
   * (the incident refNo, e.g. SEC/2026/001 -> folder SEC-2026-001).
   * Returns the storagePath to record on the attachment row and the decoded
   * size in bytes. Throws on oversized/empty payloads.
   */
  async saveBase64(caseRef: string, attachmentId: string, fileName: string, base64Data: string, mimeType?: string): Promise<{ storagePath: string; fileSize: number }> {
    const buffer = decodeBase64(base64Data);
    const folder = sanitizeCaseFolder(caseRef);
    const storedName = `${attachmentId}__${sanitizeFileName(fileName)}`;

    if (azureConfigured()) {
      const container = await getContainer();
      const blobName = `${folder}/${storedName}`;
      await container.getBlockBlobClient(blobName).uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: mimeType || 'application/octet-stream' }
      });
      return { storagePath: `${AZURE_PREFIX}${blobName}`, fileSize: buffer.length };
    }

    const dir = path.join(UPLOAD_ROOT, folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, storedName), buffer);
    return { storagePath: path.posix.join(folder, storedName), fileSize: buffer.length };
  },

  async exists(storagePath: string): Promise<boolean> {
    try {
      if (storagePath.startsWith(AZURE_PREFIX)) {
        const container = await getContainer();
        return await container.getBlockBlobClient(storagePath.slice(AZURE_PREFIX.length)).exists();
      }
      return fs.existsSync(resolveLocal(storagePath));
    } catch {
      return false;
    }
  },

  /** Readable stream of the stored file, wherever it lives. */
  async openReadStream(storagePath: string): Promise<NodeJS.ReadableStream> {
    if (storagePath.startsWith(AZURE_PREFIX)) {
      const container = await getContainer();
      const download = await container.getBlockBlobClient(storagePath.slice(AZURE_PREFIX.length)).download();
      if (!download.readableStreamBody) {
        throw new Error('Blob download returned no stream');
      }
      return download.readableStreamBody as unknown as Readable;
    }
    return fs.createReadStream(resolveLocal(storagePath));
  }
};
