import { Injectable } from '@nestjs/common';
import { PrefillTargetInvalidException } from '@/common/errors/domain.exceptions';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import {
  PROGRAM_DEFAULT_LEAF_PATHS,
  type PrefillOrigin,
  type PrefillOriginMap,
  type ProgramDefaultLeafPath,
  type ProgramDefaultsDto,
} from '../dto/program-defaults.dto';
import { validateProgramDefaults } from '../validation/program-defaults.validator';
import { BankProgramRepository } from '../bank-programs.repository';

export interface PrefillQuery {
  category: string;
  bankId?: string;
  programNameKey?: string;
}

export interface PrefillResult {
  values: ProgramDefaultsDto;
  origin: PrefillOriginMap;
}

/** Lowest priority first — a later layer overwrites an earlier one, leaf by leaf. */
const LAYER_PRIORITY: readonly PrefillOrigin[] = ['BANK_POLICY', 'CATALOG'];

/**
 * Feature 010 — resolves the starting values for a NEW bank program (FR-008).
 *
 * Two layers, merged per leaf, catalog winning:
 *   1. the bank's lending policy   → `origin: 'BANK_POLICY'`  (FR-005, US6)
 *   2. the predefined program's per-category defaults → `origin: 'CATALOG'` (FR-001)
 * A leaf neither layer supplies is reported as `EMPTY` so the form can mark it
 * as admin-entered rather than inherited (FR-010).
 *
 * This is a RESPONSE ONLY. Nothing is created, values are copied into the program
 * on save and never re-resolved (FR-009 / SC-008), and matching never calls this
 * service — it reads the bank program alone (FR-021b).
 */
@Injectable()
export class PrefillService {
  constructor(
    private readonly enums: PlatformEnumerationsRepository,
    private readonly programs: BankProgramRepository,
  ) {}

  async resolve(query: PrefillQuery): Promise<PrefillResult> {
    const servesCategory = await this.enums.isActiveMember('product_category', query.category);
    if (!servesCategory) {
      throw new PrefillTargetInvalidException({
        reason: 'CATEGORY_NOT_SERVED',
        category: query.category,
      });
    }

    const layers = new Map<PrefillOrigin, ProgramDefaultsDto>();

    const bankPolicy = await this.loadBankPolicyLayer(query.bankId);
    if (bankPolicy) layers.set('BANK_POLICY', bankPolicy);

    const catalog = await this.loadCatalogLayer(query.programNameKey, query.category);
    if (catalog) layers.set('CATALOG', catalog);

    return this.merge(layers);
  }

  /**
   * Bank lending policy layer (FR-005). The `Bank.policyDefaults` column lands with
   * US6 (T118–T120); until then a bank id is still validated so the admin gets
   * `PREFILL_TARGET_INVALID` rather than a silently empty prefill.
   */
  private async loadBankPolicyLayer(bankId?: string): Promise<ProgramDefaultsDto | null> {
    if (!bankId) return null;
    const bank = await this.programs.findBankById(bankId);
    if (!bank) {
      throw new PrefillTargetInvalidException({ reason: 'BANK_NOT_FOUND', bankId });
    }
    return null;
  }

  /** Predefined-program catalog layer (FR-001). Wins every contested leaf (FR-008). */
  private async loadCatalogLayer(
    programNameKey: string | undefined,
    category: string,
  ): Promise<ProgramDefaultsDto | null> {
    if (!programNameKey) return null;

    const member = await this.enums.findMember('program_name', programNameKey);
    if (!member) {
      throw new PrefillTargetInvalidException({ reason: 'PROGRAM_NAME_NOT_FOUND', programNameKey });
    }
    if (!member.categories.includes(category)) {
      throw new PrefillTargetInvalidException({
        reason: 'PROGRAM_NAME_DOES_NOT_SERVE_CATEGORY',
        programNameKey,
        category,
      });
    }

    const forCategory = (member.defaults as Record<string, unknown>)[category];
    if (forCategory === undefined || forCategory === null) return null;
    // Stored rows are validated on write; re-validating on read keeps a hand-edited
    // or seeded row from reaching the form as an unvalidated shape.
    return validateProgramDefaults(forCategory, `defaults.${category}`);
  }

  /** Walks the declared leaf paths once so `values` and `origin` can never drift apart. */
  private merge(layers: Map<PrefillOrigin, ProgramDefaultsDto>): PrefillResult {
    const values: Record<string, unknown> = {};
    const origin: PrefillOriginMap = {};

    for (const path of PROGRAM_DEFAULT_LEAF_PATHS) {
      let resolved: unknown;
      let resolvedFrom: PrefillOrigin = 'EMPTY';

      for (const layer of LAYER_PRIORITY) {
        const candidate = readLeaf(layers.get(layer), path);
        if (candidate === undefined) continue;
        resolved = candidate;
        resolvedFrom = layer;
      }

      origin[path] = resolvedFrom;
      if (resolvedFrom !== 'EMPTY') writeLeaf(values, path, resolved);
    }

    return { values: values as ProgramDefaultsDto, origin };
  }
}

function readLeaf(source: ProgramDefaultsDto | undefined, path: ProgramDefaultLeafPath): unknown {
  if (!source) return undefined;
  let cursor: unknown = source;
  for (const segment of path.split('.')) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor === null ? undefined : cursor;
}

function writeLeaf(target: Record<string, unknown>, path: ProgramDefaultLeafPath, value: unknown): void {
  const segments = path.split('.');
  const leaf = segments.pop();
  if (leaf === undefined) return;
  let cursor = target;
  for (const segment of segments) {
    const next = cursor[segment];
    if (next === undefined || next === null || typeof next !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[leaf] = value;
}
