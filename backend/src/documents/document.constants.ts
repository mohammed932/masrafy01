// Document upload constraints.
// Relocated here when the `activities` module (feature 005) was removed; these
// constants are document-domain concerns, not lead-activity concerns.
// Same-PR rule (Principle III): FILE_TOO_LARGE / FILE_TYPE_NOT_ALLOWED error codes
// live in common/errors/error-codes.ts + admin i18n error-codes.{ar-EG,en-US}.json.

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/pdf',
] as const;
export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
