// Strip applicant first/last name substrings (case-insensitive) from filenames
// before persistence. Used by activity-create handler when attachedDocumentIds
// are present. Two-pass: word-boundary strip then any remaining occurrence.

const NAME_TOKEN_MIN = 2;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripPiiFromFilename(filename: string, applicantName: string | null): string {
  if (!filename) return filename;
  if (!applicantName) return filename;
  const tokens = applicantName
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= NAME_TOKEN_MIN);
  if (tokens.length === 0) return filename;
  const pattern = new RegExp(`(${tokens.map(escapeRegex).join('|')})`, 'gi');
  return filename.replace(pattern, '_redacted_');
}
