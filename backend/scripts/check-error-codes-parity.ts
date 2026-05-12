#!/usr/bin/env tsx
/**
 * CI gate enforcing Principle III: every code in backend/src/common/errors/error-codes.ts
 * MUST also exist as a key in BOTH admin/src/i18n/error-codes.ar-EG.json and
 * admin/src/i18n/error-codes.en-US.json. Exits non-zero on drift.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..', '..');
const codesPath = resolve(repoRoot, 'backend', 'src', 'common', 'errors', 'error-codes.ts');
const arPath = resolve(repoRoot, 'admin', 'src', 'i18n', 'error-codes.ar-EG.json');
const enPath = resolve(repoRoot, 'admin', 'src', 'i18n', 'error-codes.en-US.json');

function loadBackendCodes(): Set<string> {
  const src = readFileSync(codesPath, 'utf8');
  const re = /(\w+):\s*'([A-Z_]+)'/g;
  const codes = new Set<string>();
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1] === m[2]) codes.add(m[2]);
  }
  return codes;
}

function loadJsonKeys(path: string): Set<string> {
  const obj = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  return new Set(Object.keys(obj));
}

const backendCodes = loadBackendCodes();
const arCodes = loadJsonKeys(arPath);
const enCodes = loadJsonKeys(enPath);

const missingInAr = [...backendCodes].filter((c) => !arCodes.has(c));
const missingInEn = [...backendCodes].filter((c) => !enCodes.has(c));
const orphanInAr = [...arCodes].filter((c) => !backendCodes.has(c));
const orphanInEn = [...enCodes].filter((c) => !backendCodes.has(c));

const issues: string[] = [];
if (missingInAr.length) issues.push(`Missing in ar-EG.json: ${missingInAr.join(', ')}`);
if (missingInEn.length) issues.push(`Missing in en-US.json: ${missingInEn.join(', ')}`);
if (orphanInAr.length) issues.push(`Orphan in ar-EG.json (no backend code): ${orphanInAr.join(', ')}`);
if (orphanInEn.length) issues.push(`Orphan in en-US.json (no backend code): ${orphanInEn.join(', ')}`);

if (issues.length > 0) {
  console.error('[check-error-codes-parity] FAIL');
  for (const i of issues) console.error('  - ' + i);
  process.exit(1);
}

console.log(
  `[check-error-codes-parity] OK — ${backendCodes.size} codes in sync across backend, ar-EG, en-US.`,
);
