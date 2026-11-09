/**
 * A no-payslip product's LIFECYCLE, as an operator drives it (v33.0.0): create, rename,
 * duplicate, delete — and a test quote before it goes live.
 *
 * ─── What changed, and what did not ───────────────────────────────────────────
 *
 * v22.0.0 made products seeded-only: the library was code, and the operator's one lifecycle
 * action was ON / OFF. That kept the shapes coherent and made every new product a release.
 * This service reopens the door WITHOUT reopening the free-form graph: a product is still
 * assembled from the fixed mechanisms in `product-template.ts` (choice table, class table,
 * number bands, share, multiple, divided-by, flat amount; columns, uplift, share, conditions),
 * edited on the calculation screen, validated and compiled exactly as before. What the
 * operator gains is the row: a new product, a copy, a starter from the library, a rename,
 * and a delete.
 *
 * ─── Safety rails ─────────────────────────────────────────────────────────────
 *
 *   · Every product created here starts OFF. It cannot quote, and no catalog name can link to
 *     it (a link needs a live product), until it has a calculation and asks something —
 *     `PUT …/active` refuses with `SURROGATE_PRODUCT_NOT_READY` until then.
 *   · Every write goes through the services an operator's other clicks go through — the
 *     template endpoint (compile + validator + orphan check), the default setters, the ask
 *     repository — so a copy is checked exactly as a hand-filled form is.
 *   · Delete is refused while anything still quotes from the product, naming what does.
 *     OFF stays the reversible way to stop one. A deleted key is TOMBSTONED by its audit
 *     event, so `npm run seed:blueprints` never brings a deleted starter back.
 */

import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditEventType } from '../../common/audit/audit-event-types';
import { AuditEventWriter } from '../../audit/audit-event.writer';
import { DomainException } from '../../common/errors/domain.exceptions';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  PlatformEnumerationsAdminService,
  type AdminActor,
} from '../../platform-enumerations/platform-enumerations-admin.service';
import { PostgresPlatformEnumerationsRepository } from '../../platform-enumerations/postgres-platform-enumerations.repository';
import { parentTypeOf } from '../../platform-enumerations/platform-enumerations.repository';
import type { SetProductGroupsDto } from './surrogate-product-lifecycle.dto';
import { QuestionnaireService } from '../../questionnaire/questionnaire.service';
import { slugify } from '../../questionnaire/slug.util';
import {
  evaluateProductRule,
  factsReadBy,
  type ProductRule,
} from '../../matching/pipeline/product-rule';
import { waysOfRule } from '../../matching/pipeline/product-rule-ways';
import type { ProductTemplate } from '../../matching/pipeline/product-template';
import { stripUnchosenWays } from '../../matching/pipeline/income-rule-inherit';
import {
  derivedFactOptionCodes,
  isDerivedFactKey,
} from '../../matching/pipeline/surrogate-fact-registry';
import type { IncomeAssumptionConfig, SurrogateFactValue } from '../../matching/types';
import { BankProgramsService } from '../bank-programs.service';
import { BlueprintService } from '../blueprints/blueprint.service';
import { ensureBlueprintAsks } from '../blueprints/blueprint-seed-asks';
import { isCapOnlyProduct, productBlueprint } from '../blueprints/product-blueprints';
import { ASK_SOURCE, ProductAsksRepository } from '../asks/product-asks.repository';
import type {
  CheckSurrogateProductDto,
  CreateSurrogateProductDto,
  RenameSurrogateProductDto,
  SurrogateProductCheckInputsDto,
  SurrogateProductCheckResultDto,
  SurrogateProductCreatedDto,
  SurrogateProductDeletedDto,
} from './surrogate-product-lifecycle.dto';

const PRODUCT_TYPE = 'surrogate_product';
const FACT_TYPE = 'surrogate_fact';
/** Positional and third on `create`, so no request body can claim it. */
const PRODUCT_ADMIN_SOURCE = { source: 'product_admin' } as const;

/** The actor shape `BankProgramsService` speaks. */
interface ProgramsActor {
  id: string;
  sourceIp: string | null;
}

@Injectable()
export class SurrogateProductLifecycleService {
  constructor(
    private readonly enums: PlatformEnumerationsAdminService,
    private readonly repo: PostgresPlatformEnumerationsRepository,
    private readonly asks: ProductAsksRepository,
    private readonly audit: AuditEventWriter,
    private readonly blueprints: BlueprintService,
    @Inject(forwardRef(() => BankProgramsService))
    private readonly programs: BankProgramsService,
    @Inject(forwardRef(() => QuestionnaireService))
    private readonly questionnaire: QuestionnaireService,
  ) {}

  // ---- Create ---------------------------------------------------------------

  /**
   * A new product, OFF, from one of three starts:
   *
   *   `blank`    the row alone — the calculation screen opens on the mechanism picker;
   *   `starter`  one of the library's income / ceiling products, under a name of the
   *              operator's: its questions, lists, facts and calculation, reusing every one
   *              that already exists (`BlueprintService.createFromBlueprint`, the seed's path);
   *   `copy`     another product's calculation, figures, defaults and questions.
   *
   * The key follows from the English name (`slugify`, never `uniqueSlug`): a taken key is a
   * refusal the operator acts on, not a silent `_2`. A key the library reserves for a starter
   * that has never been installed is refused too, so a blank product cannot inherit a starter's
   * cap grid or cap-only treatment by name.
   */
  async create(
    dto: CreateSurrogateProductDto,
    actor: ProgramsActor,
  ): Promise<SurrogateProductCreatedDto> {
    const labelEn = dto.labelEn.trim();
    const labelAr = dto.labelAr.trim();
    const key = slugify(labelEn);
    if (key === '') {
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, { field: 'labelEn' });
    }
    if ((await this.repo.findSurrogateProduct(key)) !== null) {
      throw new DomainException(ERROR_CODES.ENUMERATION_KEY_DUPLICATE, { type: PRODUCT_TYPE, key });
    }
    const reservedBy = productBlueprint(key);
    if (reservedBy && !(dto.startFrom === 'starter' && dto.blueprintKey === key)) {
      throw new DomainException(ERROR_CODES.ENUMERATION_KEY_DUPLICATE, {
        type: PRODUCT_TYPE,
        key,
        reason: 'reserved_for_starter',
      });
    }

    const adminActor: AdminActor = { staffId: actor.id, sourceIp: actor.sourceIp };
    switch (dto.startFrom) {
      case 'blank':
        await this.enums.create(
          { type: PRODUCT_TYPE, key, labelEn, labelAr },
          adminActor,
          PRODUCT_ADMIN_SOURCE,
        );
        break;
      case 'cap':
        // A CAP-ONLY product (v33.1.0): no calculation, ever. Its page asks for the one answer
        // each bank caps its own maximum by; that answer is what makes it ready.
        await this.enums.create(
          { type: PRODUCT_TYPE, key, labelEn, labelAr },
          adminActor,
          PRODUCT_ADMIN_SOURCE,
        );
        await this.repo.setSurrogateProductCapOnly(key, true);
        break;
      case 'starter':
        await this.createFromStarter(key, labelEn, labelAr, dto.blueprintKey, adminActor);
        break;
      case 'copy':
        await this.createCopy(key, labelEn, labelAr, dto.sourceKey, actor);
        break;
    }

    await this.switchOff(key, adminActor);
    return { key, startFrom: dto.startFrom };
  }

  private async createFromStarter(
    key: string,
    labelEn: string,
    labelAr: string,
    blueprintKey: string | undefined,
    actor: AdminActor,
  ): Promise<void> {
    const blueprint = blueprintKey === undefined ? undefined : productBlueprint(blueprintKey);
    if (!blueprint) {
      throw new DomainException(ERROR_CODES.PRODUCT_BLUEPRINT_UNKNOWN, {
        blueprintKey: blueprintKey ?? null,
      });
    }
    // A cap-only starter works out nothing; its whole content is a cap table each bank fills
    // on its own program, keyed by the blueprint it came from — there is no product to copy.
    if (blueprint.template === null) {
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
        field: 'blueprintKey',
        reason: 'cap_only',
      });
    }
    await this.blueprints.createFromBlueprint(
      { blueprintKey: blueprint.key, key, labelEn, labelAr },
      actor,
    );
    // The library's own statement of what the product reads — the same pass the seed runs.
    await ensureBlueprintAsks({
      blueprint,
      productKey: key,
      asks: this.asks,
      actorStaffId: actor.staffId,
    });
  }

  private async createCopy(
    key: string,
    labelEn: string,
    labelAr: string,
    sourceKey: string | undefined,
    actor: ProgramsActor,
  ): Promise<void> {
    const source = sourceKey === undefined ? null : await this.repo.findSurrogateProduct(sourceKey);
    if (!source || sourceKey === undefined) {
      throw new DomainException(ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND, {
        key: sourceKey ?? null,
      });
    }
    if (isCapOnlyProduct({ key: sourceKey, capOnly: source.capOnly })) {
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
        field: 'sourceKey',
        reason: 'cap_only',
      });
    }

    await this.enums.create(
      { type: PRODUCT_TYPE, key, labelEn, labelAr },
      { staffId: actor.id, sourceIp: actor.sourceIp },
      PRODUCT_ADMIN_SOURCE,
    );

    // Structure first, through the template endpoint (compile, validator, orphan check); then
    // the FIGURES, through the rule endpoint with the structure left out, so the stored form
    // is kept rather than dropped as hand-authored. A source with no form (built step by
    // step) goes across whole.
    if (source.templateSpec !== null) {
      await this.programs.setSurrogateProductTemplate(
        key,
        { template: source.templateSpec as unknown as Record<string, unknown> },
        actor,
      );
    }
    if (source.incomeRule !== null) {
      const rule: Partial<IncomeAssumptionConfig> & Record<string, unknown> = {
        ...source.incomeRule,
      };
      if (source.templateSpec !== null) {
        delete rule.steps;
        delete rule.gates;
        delete rule.output;
      }
      await this.programs.setSurrogateProductIncomeRule(
        key,
        { incomeRule: rule as never, valueSources: source.valueSources },
        actor,
      );
    }

    // The defaults it hands its programs, each through its own setter.
    if (source.capDefaults !== null) {
      await this.programs.setSurrogateProductCapDefaults(
        key,
        { rows: source.capDefaults } as never,
        actor,
      );
    }
    if (source.tenorDefaults !== null) {
      await this.programs.setSurrogateProductTenorDefaults(
        key,
        { tenor: source.tenorDefaults } as never,
        actor,
      );
    }
    if (source.loanAmountDefaults !== null) {
      await this.programs.setSurrogateProductLoanAmountDefaults(
        key,
        { loanAmounts: source.loanAmountDefaults } as never,
        actor,
      );
    }
    if (source.rateDefaults !== null) {
      await this.programs.setSurrogateProductRateDefaults(
        key,
        { rate: source.rateDefaults } as never,
        actor,
      );
    }
    if (source.iScoreDefaults !== null) {
      await this.programs.setSurrogateProductIScoreDefaults(
        key,
        { tiers: source.iScoreDefaults } as never,
        actor,
      );
    }
    if (source.planDefaults !== null) {
      await this.programs.setSurrogateProductPlanDefaults(
        key,
        { plans: source.planDefaults } as never,
        actor,
      );
    }

    // What it asks. The operator is the author of a copy's asks, whatever the source's were.
    for (const ask of await this.asks.asksFor(sourceKey)) {
      await this.asks.addAskByKeys({
        productKey: key,
        factKey: ask.factKey,
        source: ASK_SOURCE.operator,
        createdBy: actor.id,
        revive: true,
      });
    }

    // Its groups: where each value is filed for this product (own groups and moved values).
    const copy = await this.repo.findSurrogateProduct(key);
    const groups = await this.repo.productParentKeyRows(source.id);
    if (copy && groups.length > 0) await this.repo.setProductParentKeys(copy.id, groups, actor.id);
  }

  /** Every new product starts OFF — the readiness check is what lets it go live. */
  private async switchOff(key: string, actor: AdminActor): Promise<void> {
    const row = await this.repo.findSurrogateProduct(key);
    if (!row) return;
    await this.enums.update(row.id, { active: false }, actor);
  }

  // ---- Rename ---------------------------------------------------------------

  /** The names only. The KEY is immutable: bank programs, names and figures address it. */
  async rename(key: string, dto: RenameSurrogateProductDto, actor: ProgramsActor): Promise<void> {
    const row = await this.repo.findSurrogateProduct(key);
    if (!row) throw new DomainException(ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND, { key });
    await this.enums.update(
      row.id,
      { labelEn: dto.labelEn.trim(), labelAr: dto.labelAr.trim() },
      { staffId: actor.id, sourceIp: actor.sourceIp },
    );
  }

  // ---- Groups (v36.1.0) -------------------------------------------------------

  /** The product's OWN classes for one value list: value key → class key (moved values only). */
  async groups(key: string, valueType: string): Promise<{ own: Record<string, string> }> {
    const row = await this.repo.findSurrogateProduct(key);
    if (!row) throw new DomainException(ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND, { key });
    return { own: await this.repo.productParentKeys(key, valueType) };
  }

  /**
   * File values in a class for THIS product's programs only — the shared lists, and every
   * other product, keep theirs. A class is either one of the product's OWN groups (named on
   * its calculation, `secondColumn.groups`), or — for a value whose list has classes — a live
   * row of that list's class kind; `null` drops the product's own row.
   */
  async setGroups(
    key: string,
    dto: SetProductGroupsDto,
    actor: ProgramsActor,
  ): Promise<{ own: Record<string, string>; moved: number }> {
    const product = await this.repo.findSurrogateProduct(key);
    if (!product) throw new DomainException(ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND, { key });
    const defs = await this.repo.typeDefinitions();
    const ownKeys = ownGroupKeys(product.templateSpec);
    const types = new Set<string>();
    for (const a of dto.assignments) {
      const value = await this.repo.findById(a.valueId);
      if (!value) throw new DomainException(ERROR_CODES.VALIDATION_FAILED, { field: 'valueId' });
      types.add(value.type);
      if (a.parentKey === null || ownKeys.has(a.parentKey)) continue;
      const parentType = parentTypeOf(defs, value.type);
      if (parentType === null) {
        throw new DomainException(ERROR_CODES.ENUMERATION_PARENT_NOT_APPLICABLE, {
          type: value.type,
        });
      }
      const parent = await this.repo.findByTypeAndKey(parentType, a.parentKey);
      if (!parent || !parent.active || parent.deprecatedAt !== null) {
        throw new DomainException(ERROR_CODES.ENUMERATION_PARENT_UNKNOWN, {
          type: parentType,
          parentKey: a.parentKey,
        });
      }
    }
    const moved = await this.repo.setProductParentKeys(product.id, dto.assignments, actor.id);
    await this.audit.write({
      actorId: actor.id,
      targetId: null,
      eventType: AuditEventType.PLATFORM_ENUMERATION_UPDATED,
      sourceIp: actor.sourceIp,
      payload: {
        type: PRODUCT_TYPE,
        key,
        id: product.id,
        changes: {
          groups: dto.assignments.map((a) => ({ valueId: a.valueId, parentKey: a.parentKey })),
        },
      },
    });
    const own: Record<string, string> = {};
    for (const type of types) Object.assign(own, await this.repo.productParentKeys(key, type));
    return { own, moved };
  }

  // ---- Delete ---------------------------------------------------------------

  /**
   * Delete a product nothing quotes from.
   *
   * Refused with `SURROGATE_PRODUCT_IN_USE` while a catalog name links to it, a bank program
   * is filed under one of those names, or a bank program caps its maximum by one of its
   * answers — each named, so the operator moves them or switches the product off instead.
   *
   * What goes with it: its ask rows (FK cascade), and every fact filed under it that no other
   * product asks and nothing else reads (through the registry's own delete and its guards).
   * A fact still in use elsewhere is kept and un-filed. QUESTIONS are left in the pool: a
   * question is asked only when something reads it, so one nobody reads any more is simply
   * not served, and its past answers stay readable on old applications.
   */
  async delete(key: string, actor: ProgramsActor): Promise<SurrogateProductDeletedDto> {
    const row = await this.repo.findSurrogateProduct(key);
    if (!row) throw new DomainException(ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND, { key });

    const detail = await this.programs.getSurrogateProduct(key);
    const names = detail.names.map((name) => name.key);
    const programCodes = detail.names.flatMap((name) => name.programs.map((p) => p.programCode));
    // A cap program caps by an ANSWER, and many products can ask one answer. It is this
    // product's usage only when the product is cap-only — that cap is all it is. For any other
    // product the fact stays (another product asks it, or the registry's delete refuses it
    // while a cap still reads it), so the cap program is untouched by this delete.
    const capPrograms = detail.capOnly ? detail.capPrograms : [];
    if (names.length + programCodes.length + capPrograms.length > 0) {
      throw new DomainException(ERROR_CODES.SURROGATE_PRODUCT_IN_USE, {
        key,
        names,
        programCodes,
        capPrograms,
        count: new Set([...names, ...programCodes, ...capPrograms]).size,
      });
    }

    const adminActor: AdminActor = { staffId: actor.id, sourceIp: actor.sourceIp };
    const askedFacts = (await this.asks.asksFor(key)).map((ask) => ask.factKey);
    const filedFacts = (await this.enums.listAll({ type: FACT_TYPE }))
      .filter((fact) => fact.surrogateProductKey === key)
      .map((fact) => fact.key);

    await this.repo.deleteById(row.id);
    this.repo.invalidateCache(PRODUCT_TYPE);
    // This event is also the TOMBSTONE the blueprint seed reads: a starter an operator deleted
    // is never seeded back.
    await this.audit.write({
      actorId: actor.id,
      targetId: null,
      eventType: AuditEventType.PLATFORM_ENUMERATION_DELETED,
      sourceIp: actor.sourceIp,
      payload: { type: PRODUCT_TYPE, key, id: row.id, labelAr: row.labelAr, labelEn: row.labelEn },
    });

    const deletedFacts: string[] = [];
    const keptFacts: string[] = [];
    for (const factKey of [...new Set([...askedFacts, ...filedFacts])].sort()) {
      const fact = await this.repo.findByTypeAndKey(FACT_TYPE, factKey);
      if (!fact) continue;
      const ownedHere = fact.surrogateProductKey === key;
      const stillAsked = (await this.asks.productsAsking(factKey)).length > 0;
      if (ownedHere && !stillAsked && !fact.systemOnly) {
        try {
          // The registry's own delete: its reference count (bank programs, rules, caps) and
          // its audit event decide, not this service.
          await this.enums.remove(fact.id, adminActor);
          deletedFacts.push(factKey);
          continue;
        } catch (error) {
          if (!(error instanceof DomainException)) throw error;
        }
      }
      keptFacts.push(factKey);
      if (ownedHere) await this.enums.update(fact.id, { surrogateProductKey: null }, adminActor);
    }

    return { key, deletedFacts, keptFacts };
  }

  // ---- Test quote -----------------------------------------------------------

  /**
   * What the test panel asks: every answer the calculation reads, with its question and
   * options, and the ways a bank could pick between.
   */
  async checkInputs(key: string): Promise<SurrogateProductCheckInputsDto> {
    const row = await this.repo.findSurrogateProduct(key);
    if (!row) throw new DomainException(ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND, { key });
    const rule = row.incomeRule as unknown as ProductRule | null;
    if (rule === null || !Array.isArray(rule.steps)) {
      return { key, outputKind: null, ways: [], inputs: [] };
    }

    const [bindings, tree] = await Promise.all([
      this.repo.surrogateFactRegistry(),
      this.questionnaire.draftTree(),
    ]);
    const questionByCode = new Map(
      tree.flatMap((group) => group.questions).map((q) => [q.code, q]),
    );
    const bindingByKey = new Map(bindings.map((binding) => [binding.key, binding]));

    const inputs: SurrogateProductCheckInputsDto['inputs'] = factsReadBy(rule).map((factKey) => {
      if (isDerivedFactKey(factKey)) {
        return {
          factKey,
          questionCode: null,
          labelEn: factKey,
          labelAr: factKey,
          type: 'choice' as const,
          options: (derivedFactOptionCodes(factKey) ?? []).map((code) => ({
            code,
            labelEn: code,
            labelAr: code,
          })),
        };
      }
      const binding = bindingByKey.get(factKey);
      const question = binding ? questionByCode.get(binding.questionCode) : undefined;
      const isNumber = question?.type === 'NUMERIC' || binding?.type === 'NUMERIC';
      return {
        factKey,
        questionCode: question?.code ?? binding?.questionCode ?? null,
        labelEn: question?.questionEn ?? factKey,
        labelAr: question?.questionAr ?? factKey,
        type: isNumber ? ('number' as const) : ('choice' as const),
        options: isNumber
          ? []
          : (question?.options ?? []).map((option) => ({
              code: option.code,
              labelEn: option.labelEn,
              labelAr: option.labelAr,
            })),
      };
    });

    return {
      key,
      outputKind: rule.output?.kind === 'maxAmount' ? 'maxAmount' : 'monthlyIncome',
      ways: waysOfRule(rule).map((way) => way.id),
      inputs,
    };
  }

  /**
   * Run sample answers through the product's own calculation and figures. Persists nothing.
   *
   * The engine's own `evaluateProductRule`, on the product's rule narrowed to one way the same
   * way a bank program's is (`stripUnchosenWays`) — so what the panel shows is what a bank
   * program taking the product's figures would compute, before its own DBR, cap and rate.
   */
  async check(key: string, dto: CheckSurrogateProductDto): Promise<SurrogateProductCheckResultDto> {
    const row = await this.repo.findSurrogateProduct(key);
    if (!row) throw new DomainException(ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND, { key });
    if (row.incomeRule === null) return { ok: false, reason: 'rule_unconfigured' };

    const config: IncomeAssumptionConfig =
      dto.wayId !== undefined && dto.wayId !== ''
        ? { ...row.incomeRule, wayId: dto.wayId }
        : row.incomeRule;
    const rule = stripUnchosenWays(config, config) as unknown as ProductRule;

    const facts: Record<string, SurrogateFactValue> = {};
    for (const answer of dto.answers) {
      if (answer.optionCodes !== undefined && answer.optionCodes.length > 0) {
        facts[answer.factKey] = { kind: 'choices', optionCodes: answer.optionCodes };
      } else if (answer.optionCode !== undefined && answer.optionCode !== '') {
        facts[answer.factKey] = { kind: 'choice', optionCode: answer.optionCode };
      } else if (answer.value !== undefined && answer.value !== '') {
        let value: Decimal;
        try {
          value = new Decimal(answer.value);
        } catch {
          throw new DomainException(ERROR_CODES.VALIDATION_FAILED, { field: answer.factKey });
        }
        facts[answer.factKey] = { kind: 'numeric', value };
      }
    }

    // The shared classes, with this product's own over them — what its programs quote with.
    const parentKeyByValue = {
      ...(await this.repo.enumerationParentKeys()),
      ...((await this.repo.productParentKeyMaps()).get(key) ?? {}),
    };
    const outcome = evaluateProductRule(rule, { facts, parentKeyByValue });
    if (outcome.ok) {
      return { ok: true, kind: outcome.kind, valueEGP: outcome.valueEGP.toFixed(2) };
    }
    return {
      ok: false,
      reason: outcome.reason,
      ...(outcome.factKey !== undefined ? { factKey: outcome.factKey } : {}),
      ...(outcome.gateId !== undefined ? { gateId: outcome.gateId } : {}),
      ...(outcome.gateReasonCode !== undefined ? { gateReasonCode: outcome.gateReasonCode } : {}),
    };
  }
}

/** The keys of a product's own groups, on its column or on any way's own column. */
function ownGroupKeys(template: ProductTemplate | null): Set<string> {
  const keys = new Set<string>();
  if (template === null) return keys;
  const ways = template.alternatives ?? (template.alternative ? [template.alternative] : []);
  for (const column of [
    template.secondColumn,
    template.primary.column,
    ...ways.map((w) => w.column),
  ]) {
    for (const group of column?.groups ?? []) keys.add(group.key);
  }
  return keys;
}
