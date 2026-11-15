/**
 * Ready methods (v37.0.0): the ways of working out a product's amount, kept as a list.
 *
 * A product's way can be LINKED to one (`TemplateMechanism.methodKey`): saving the method then
 * rewrites that way — its questions, how, columns, groups and figures — on every product
 * linked to it, through the same template save a product page uses (compile, validators,
 * orphan check, audit). A method a product is linked to cannot be deleted.
 */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  DomainException,
  MethodTemplateInUseException,
  MethodTemplateNameTakenException,
  MethodTemplateNotFoundException,
  ProductTemplateInvalidException,
} from '@/common/errors/domain.exceptions';
import {
  columnSlot,
  validateTemplate,
  waySlot,
  type ProductTemplate,
  type TemplateMechanism,
} from '@/matching/pipeline/product-template';
import { BankProgramsService } from '../bank-programs.service';
import { SurrogateProductLifecycleService } from '../products/surrogate-product-lifecycle.service';
import { MethodTemplatesRepository, type MethodTemplateRow } from './method-templates.repository';
import type {
  CreateMethodTemplateDto,
  MethodTemplateDto,
  MethodTemplateSavedDto,
  UpdateMethodTemplateDto,
} from './method-templates.dto';
import { METHOD_TEMPLATE_SEEDS } from './method-templates.seed';

const FIGURE_KEYS = new Set(['keyTable', 'bands', 'scalar', 'valueEGP']);

type Figures = Record<string, unknown>;
interface Actor {
  id: string;
  sourceIp: string | null;
}
interface LinkedProduct {
  key: string;
  labelEn: string;
  labelAr: string;
  template: ProductTemplate;
  stepParams: Figures;
}

@Injectable()
export class MethodTemplatesService implements OnApplicationBootstrap {
  private readonly log = new Logger(MethodTemplatesService.name);

  constructor(
    private readonly repo: MethodTemplatesRepository,
    private readonly programs: BankProgramsService,
    private readonly lifecycle: SurrogateProductLifecycleService,
  ) {}

  /**
   * Insert any shipped method whose key is missing — and nothing else. An edited method keeps
   * its edits, and a deleted one keeps its tombstone, so a restart never undoes the operator.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const inserted = await this.seedMissing();
      if (inserted > 0) this.log.log(`ready methods: ${inserted} inserted`);
    } catch (err) {
      // Never block the app from starting over a list nobody quotes from.
      this.log.warn(`ready methods were not seeded: ${(err as Error).message}`);
    }
  }

  async seedMissing(): Promise<number> {
    const taken = await this.repo.allKeys();
    let inserted = 0;
    for (const seed of METHOD_TEMPLATE_SEEDS) {
      if (taken.has(seed.key)) continue;
      await this.repo.create({
        key: seed.key,
        labelEn: seed.labelEn,
        labelAr: seed.labelAr,
        mechanism: seed.mechanism,
        figures: seed.figures,
        source: 'seed',
        sortOrder: seed.sortOrder,
      });
      inserted += 1;
    }
    return inserted;
  }

  async list(): Promise<MethodTemplateDto[]> {
    const [rows, linked] = await Promise.all([this.repo.listLive(), this.linkedProducts()]);
    return rows.map((row) => toDto(row, linked));
  }

  async create(dto: CreateMethodTemplateDto, actorId?: string): Promise<MethodTemplateDto> {
    const labelEn = dto.labelEn.trim();
    const labelAr = dto.labelAr.trim();
    if (await this.repo.findLiveByLabel(labelEn)) {
      throw new MethodTemplateNameTakenException({ labelEn });
    }
    const mechanism = assertMechanism(dto.mechanism);
    const figures = assertFigures(dto.figures ?? {}, mechanism);
    const placements = assertPlacements(dto.placements ?? {}, mechanism);
    const key = await this.freeKey(labelEn);
    const row = await this.repo.create({
      key,
      labelEn,
      labelAr,
      mechanism,
      figures,
      placements,
      source: 'operator',
      sortOrder: (await this.repo.maxSortOrder()) + 10,
      ...(actorId ? { updatedBy: actorId } : {}),
    });
    return toDto(row, []);
  }

  /**
   * Save the method, then rewrite it on every product linked to it. A product the save
   * refuses (a bank typed figures the new shape would orphan, say) keeps its old copy and is
   * reported by name; the others are updated.
   */
  async update(
    key: string,
    dto: UpdateMethodTemplateDto,
    actor: Actor,
  ): Promise<MethodTemplateSavedDto> {
    const current = await this.repo.findByKey(key);
    if (!current || current.deletedAt !== null) throw new MethodTemplateNotFoundException({ key });
    const labelEn = dto.labelEn?.trim();
    if (labelEn !== undefined && (await this.repo.findLiveByLabel(labelEn, key))) {
      throw new MethodTemplateNameTakenException({ labelEn });
    }
    const mechanism =
      dto.mechanism !== undefined
        ? assertMechanism(dto.mechanism)
        : (current.mechanism as TemplateMechanism);
    const figures =
      dto.figures !== undefined
        ? assertFigures(dto.figures, mechanism)
        : dto.mechanism !== undefined
          ? assertFigures(current.figures as Figures, mechanism, true)
          : (current.figures as Figures);
    const placements =
      dto.placements !== undefined
        ? assertPlacements(dto.placements, mechanism)
        : assertPlacements((current.placements ?? {}) as Figures, mechanism, true);
    const row = await this.repo.update(key, {
      ...(labelEn !== undefined ? { labelEn } : {}),
      ...(dto.labelAr !== undefined ? { labelAr: dto.labelAr.trim() } : {}),
      ...(dto.mechanism !== undefined ? { mechanism } : {}),
      ...(dto.figures !== undefined || dto.mechanism !== undefined ? { figures } : {}),
      ...(dto.placements !== undefined || dto.mechanism !== undefined ? { placements } : {}),
      updatedBy: actor.id,
    });

    const updated: string[] = [];
    const refused: Array<{ key: string; code: string; meta?: Record<string, unknown> }> = [];
    if (dto.mechanism !== undefined || dto.figures !== undefined || dto.placements !== undefined) {
      for (const product of await this.linkedProducts(key)) {
        const next = withMethod(product, key, mechanism, figures);
        try {
          await this.programs.setSurrogateProductTemplate(
            product.key,
            {
              template: next.template as unknown as Record<string, unknown>,
              stepParams: next.stepParams,
            },
            actor,
          );
          // Then who sits in which of the method's own groups, for this product too. After the
          // template: that save is what makes the group keys the product's own.
          const assignments = Object.values(placements).flatMap((list) =>
            (list as Placement[]).map((p) => ({ valueId: p.valueId, parentKey: p.group })),
          );
          if (assignments.length > 0) {
            await this.lifecycle.setGroups(product.key, { assignments }, actor);
          }
          updated.push(product.key);
        } catch (err) {
          const e = err as DomainException;
          refused.push({
            key: product.key,
            code: e.code ?? 'INTERNAL_ERROR',
            ...(e.meta ? { meta: e.meta } : {}),
          });
        }
      }
    }
    return { ...toDto(row, await this.linkedProducts()), propagation: { updated, refused } };
  }

  async remove(key: string, actorId?: string): Promise<{ key: string }> {
    const current = await this.repo.findByKey(key);
    if (!current || current.deletedAt !== null) throw new MethodTemplateNotFoundException({ key });
    const users = await this.linkedProducts(key);
    if (users.length > 0) {
      throw new MethodTemplateInUseException({
        count: users.length,
        products: users.map((p) => p.labelEn).join(', '),
      });
    }
    await this.repo.softDelete(key, actorId);
    return { key };
  }

  /** Every product with a way linked to a method (this one, or any). */
  private async linkedProducts(methodKey?: string): Promise<LinkedProduct[]> {
    const out: LinkedProduct[] = [];
    for (const summary of await this.programs.listSurrogateProducts()) {
      if (!summary.wayCount) continue;
      const read = await this.programs.getSurrogateProductTemplate(summary.key);
      const template = read.template as ProductTemplate | null;
      if (!template) continue;
      const ways = waysOfTemplate(template);
      const linked = ways.some((w) =>
        methodKey === undefined ? !!w.methodKey : w.methodKey === methodKey,
      );
      if (!linked) continue;
      out.push({
        key: summary.key,
        labelEn: summary.labelEn,
        labelAr: summary.labelAr,
        template,
        stepParams: { ...((read.compiled?.stepParams ?? {}) as Figures) },
      });
    }
    return out;
  }

  /** `by_compound_class`, then `_2`, `_3`… — a deleted method's key is never reused. */
  private async freeKey(labelEn: string): Promise<string> {
    const base =
      labelEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50) || 'method';
    const taken = await this.repo.allKeys();
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}_${n}`)) n += 1;
    return `${base}_${n}`;
  }
}

function waysOfTemplate(t: ProductTemplate): TemplateMechanism[] {
  return [t.primary, ...(t.alternatives ?? (t.alternative ? [t.alternative] : []))];
}

/**
 * The product with every way linked to `methodKey` replaced by the method: the way itself and
 * the figures in its slots. A one-way product keeps its split on `secondColumn`, the shape it
 * was stored in, so a link never reshapes what is around the way.
 */
function withMethod(
  product: LinkedProduct,
  methodKey: string,
  mechanism: TemplateMechanism,
  figures: Figures,
): { template: ProductTemplate; stepParams: Figures } {
  const template: ProductTemplate = structuredClone(product.template);
  const stepParams: Figures = { ...product.stepParams };
  const single = template.alternatives === undefined && template.alternative === undefined;
  const ways = waysOfTemplate(template);
  ways.forEach((way, i) => {
    if (way.methodKey !== methodKey) return;
    const oldColumn = single ? (way.column ?? template.secondColumn) : way.column;
    const oldHead = waySlot(way, i);
    delete stepParams[oldHead];
    for (const b of oldColumn?.branches.slice(1) ?? []) delete stepParams[columnSlot(oldHead, b)];

    const { methodKey: _drop, column, ...shape } = structuredClone(mechanism);
    const next = {
      ...shape,
      ...(column && !single ? { column } : {}),
      methodKey,
    } as TemplateMechanism;
    if (i === 0) template.primary = next;
    else if (template.alternatives) template.alternatives[i - 1] = next;
    else template.alternative = next;
    if (single) {
      if (column) template.secondColumn = column;
      else delete template.secondColumn;
    }

    const head = waySlot(next, i);
    for (const [col, figure] of Object.entries(figures)) {
      stepParams[col === '' ? head : columnSlot(head, col)] = structuredClone(figure);
    }
  });
  return { template, stepParams };
}

function toDto(row: MethodTemplateRow, linked: readonly LinkedProduct[]): MethodTemplateDto {
  return {
    key: row.key,
    labelEn: row.labelEn,
    labelAr: row.labelAr,
    mechanism: row.mechanism as Record<string, unknown>,
    figures: (row.figures ?? {}) as Record<string, unknown>,
    placements: (row.placements ?? {}) as Record<string, unknown>,
    source: row.source,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
    usedBy: linked
      .filter((p) => waysOfTemplate(p.template).some((w) => w.methodKey === row.key))
      .map((p) => ({ key: p.key, labelEn: p.labelEn, labelAr: p.labelAr })),
  };
}

interface Placement {
  valueId: string;
  code: string;
  group: string;
}

/**
 * The members of the method's own groups: per question, each answer's group — only for a
 * question the method groups (its rows, or its column), only into a group it has.
 */
function assertPlacements(
  raw: Figures,
  mechanism: TemplateMechanism,
  prune = false,
): Record<string, Placement[]> {
  const groupsOf = new Map<string, Set<string>>();
  if (mechanism.kind === 'classTable' && mechanism.groups) {
    groupsOf.set(mechanism.fact, new Set(mechanism.groups.map((g) => g.key)));
  }
  if (mechanism.column?.groups) {
    groupsOf.set(mechanism.column.fact, new Set(mechanism.column.groups.map((g) => g.key)));
  }
  const out: Record<string, Placement[]> = {};
  for (const [fact, list] of Object.entries(raw)) {
    const keys = groupsOf.get(fact);
    if (!keys) {
      if (prune) continue;
      throw new ProductTemplateInvalidException({ reason: 'placements_invalid', detail: fact });
    }
    if (!Array.isArray(list)) {
      throw new ProductTemplateInvalidException({ reason: 'placements_invalid', detail: fact });
    }
    const kept: Placement[] = [];
    for (const item of list as unknown[]) {
      const p = item as Partial<Placement>;
      const ok =
        typeof p.valueId === 'string' &&
        p.valueId !== '' &&
        typeof p.code === 'string' &&
        typeof p.group === 'string';
      if (!ok) {
        throw new ProductTemplateInvalidException({ reason: 'placements_invalid', detail: fact });
      }
      if (!keys.has(p.group as string)) {
        if (prune) continue;
        throw new ProductTemplateInvalidException({ reason: 'placements_invalid', detail: fact });
      }
      kept.push({ valueId: p.valueId as string, code: p.code as string, group: p.group as string });
    }
    out[fact] = kept;
  }
  return out;
}

/** The way, checked by the same validator a product's form is — as that form's only way. */
function assertMechanism(raw: Record<string, unknown>): TemplateMechanism {
  const { methodKey: _ignored, ...rest } = raw as unknown as TemplateMechanism;
  const mechanism = rest as TemplateMechanism;
  const asProduct: ProductTemplate = {
    version: 1,
    outputKind: 'monthlyIncome',
    primary: mechanism,
    conditions: [],
  };
  const problem = validateTemplate(asProduct);
  if (problem) {
    throw new ProductTemplateInvalidException({
      reason: problem.reason,
      ...(problem.detail !== undefined ? { detail: problem.detail } : {}),
    });
  }
  if (mechanism.kind === 'flatAmount') {
    throw new ProductTemplateInvalidException({ reason: 'mechanism_needs_fact' });
  }
  return mechanism;
}

/**
 * Figures keyed by column: `''` for the first, a branch key for each other. A figure for a
 * column the way no longer has is dropped when `prune` (a changed way keeps what still fits),
 * refused otherwise.
 */
function assertFigures(raw: Figures, mechanism: TemplateMechanism, prune = false): Figures {
  const columns = new Set(['', ...(mechanism.column?.branches.slice(1) ?? [])]);
  const out: Figures = {};
  for (const [column, figure] of Object.entries(raw)) {
    if (!columns.has(column)) {
      if (prune) continue;
      throw new ProductTemplateInvalidException({ reason: 'figures_invalid', detail: column });
    }
    const ok =
      figure !== null &&
      typeof figure === 'object' &&
      !Array.isArray(figure) &&
      Object.keys(figure).every((k) => FIGURE_KEYS.has(k));
    if (!ok)
      throw new ProductTemplateInvalidException({ reason: 'figures_invalid', detail: column });
    out[column] = figure;
  }
  return out;
}
