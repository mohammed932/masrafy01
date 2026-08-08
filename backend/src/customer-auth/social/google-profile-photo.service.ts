import { Injectable, Logger } from '@nestjs/common';
import cuid from 'cuid';
import { S3StorageClient } from '@/documents/s3-storage.client';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  type AllowedDocumentMimeType,
} from '@/documents/document.constants';
import { CustomerAccountRepository } from '../customer-account.repository';

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Hosts Google is allowed to hand us a picture from. The `picture` claim comes
 * out of a signature-verified ID token, so it is already Google-controlled —
 * this is defence in depth: without it, anything that ever loosens token
 * verification turns this into an SSRF primitive pointed at our own network.
 */
const ALLOWED_PICTURE_HOST_SUFFIXES = ['.googleusercontent.com', '.google.com'] as const;

const MIME_TO_EXT: Record<AllowedDocumentMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

/** Google avatar URLs end in a size directive (`=s96-c`); ask for a usable one. */
const REQUESTED_AVATAR_SIZE = 512;

/**
 * Imports the Google avatar (`picture` claim) into our own object storage at
 * social sign-up, then points `customerAccount.profilePhotoKey` at it.
 *
 * Copying rather than storing Google's URL keeps the photo under Principle VI
 * (our bucket, our presigned GETs, our retention) and survives Google rotating
 * or expiring the URL. Every step is best-effort — a customer whose avatar
 * fails to import simply has no photo, which is a valid state since v9.0.0, so
 * this **never throws** and never blocks sign-in.
 */
@Injectable()
export class GoogleProfilePhotoService {
  private readonly logger = new Logger(GoogleProfilePhotoService.name);

  constructor(
    private readonly s3: S3StorageClient,
    private readonly customers: CustomerAccountRepository,
  ) {}

  async importFromUrl(args: { customerId: string; pictureUrl: string }): Promise<void> {
    try {
      const url = this.normalize(args.pictureUrl);
      if (!url) return;

      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) {
        this.logger.debug({ msg: 'google_avatar_fetch_failed', status: res.status });
        return;
      }

      const mimeType = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
      if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
        this.logger.debug({ msg: 'google_avatar_type_rejected', mimeType });
        return;
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      // Checked after download, not from Content-Length: the header is
      // advisory and a chunked response omits it entirely.
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
        this.logger.debug({ msg: 'google_avatar_size_rejected', sizeBytes: bytes.byteLength });
        return;
      }

      // Same key scheme as `DocumentsService.requestProfilePhotoUploadUrl`, so
      // the ownership prefix check on confirm-upload and the presign on GET /me
      // treat an imported photo exactly like an uploaded one.
      const ext = MIME_TO_EXT[mimeType as AllowedDocumentMimeType];
      const s3Key = `customers/${args.customerId}/photo/${cuid()}.${ext}`;
      await this.s3.putObject(s3Key, bytes, mimeType);

      const previousKey = await this.customers.findProfilePhotoKey(args.customerId);
      await this.customers.setProfilePhotoKey({
        customerId: args.customerId,
        profilePhotoKey: s3Key,
      });
      if (previousKey && previousKey !== s3Key) {
        try {
          await this.s3.deleteObject(previousKey);
        } catch (err) {
          this.logger.warn({ msg: 'google_avatar_reap_failed', error: (err as Error).message });
        }
      }
    } catch (err) {
      this.logger.warn({ msg: 'google_avatar_import_failed', error: String(err) });
    }
  }

  /**
   * Validates the host and bumps the size directive so we store something
   * larger than the default 96px thumbnail. Returns `null` for anything that
   * is not an https Google-hosted URL.
   */
  private normalize(rawUrl: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    const hostAllowed = ALLOWED_PICTURE_HOST_SUFFIXES.some(
      (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
    );
    if (!hostAllowed) return null;

    // `.../photo.jpg=s96-c` → `=s512-c`. Left untouched when absent.
    return parsed.toString().replace(/=s\d+(-c)?$/, `=s${REQUESTED_AVATAR_SIZE}-c`);
  }
}
