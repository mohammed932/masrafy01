/**
 * The `surrogate_product_ask` rows — which facts a no-payslip product reads.
 *
 * WRITES THIS TABLE AND NOTHING ELSE. Every `platform_enumeration` write the ask door
 * performs still goes through `PlatformEnumerationsAdminService`, so the audit event, the
 * cache invalidation and the guards stay one implementation — the convention the product's
 * on/off switch already follows. A second, quieter write path would be a second set of
 * rules, free to disagree with the first about what is allowed.
 *
 * DETACHED ROWS ARE NOT ASKS. Every read below filters `detachedAt: null`, so nothing
 * outside this file has to remember the tombstone exists — a detached row is simply absent
 * from the product's ask set. The one caller that must NOT filter is the blueprint seed,
 * and it does not read: it inserts, idempotently by primary key, which is precisely how a
 * tombstone survives `npm run seed:blueprints`.
 *
 * Keys in, keys out. The table is keyed by `platform_enumeration.id` (both ends address the
 * primary key, which is what makes real foreign keys possible here), but no caller outside
 * this file knows an id: the service resolves `(type, key)` and passes ids down, and no DTO
 * ever carries one.
 */
import { Injectable } from '@nestjs/common';
import type { SurrogateAskSource } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/** One row of a product's ask set, resolved to the keys an operator sees. */
export interface ProductAskRow {
  productKey: string;
  factKey: string;
  source: SurrogateAskSource;
}

@Injectable()
export class ProductAsksRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One product's ask set, ordered by fact key.
   *
   * Ordered by KEY rather than by insertion, so step ① reads the same way twice and a
   * re-tick does not move a card to the bottom of the list.
   */
  async asksFor(productKey: string): Promise<ProductAskRow[]> {
    const rows = await this.prisma.surrogateProductAsk.findMany({
      where: { product: { type: 'surrogate_product', key: productKey }, detachedAt: null },
      select: { source: true, fact: { select: { key: true } } },
      orderBy: { fact: { key: 'asc' } },
    });
    return rows.map((row) => ({ productKey, factKey: row.fact.key, source: row.source }));
  }

  /**
   * Every product that reads one fact, by product key.
   *
   * The direction `platform_enumeration.surrogateProductKey` cannot answer, and the one the
   * untick decision turns on: a fact another product still reads is never deleted, only
   * un-asked here.
   */
  async productsAsking(factKey: string): Promise<string[]> {
    const rows = await this.prisma.surrogateProductAsk.findMany({
      where: { fact: { type: 'surrogate_fact', key: factKey }, detachedAt: null },
      select: { product: { select: { key: true } } },
      orderBy: { product: { key: 'asc' } },
    });
    return rows.map((row) => row.product.key);
  }

  /** Ask sets for many products at once — the board's "who else reads this" in one query. */
  async asksForFacts(factKeys: readonly string[]): Promise<Map<string, string[]>> {
    if (factKeys.length === 0) return new Map();
    const rows = await this.prisma.surrogateProductAsk.findMany({
      where: { fact: { type: 'surrogate_fact', key: { in: [...factKeys] } }, detachedAt: null },
      select: { fact: { select: { key: true } }, product: { select: { key: true } } },
      orderBy: [{ fact: { key: 'asc' } }, { product: { key: 'asc' } }],
    });
    const byFact = new Map<string, string[]>();
    for (const row of rows) {
      const list = byFact.get(row.fact.key) ?? [];
      list.push(row.product.key);
      byFact.set(row.fact.key, list);
    }
    return byFact;
  }

  /**
   * Record that a product reads a fact. Idempotent: a double-click writes once.
   *
   * `skipDuplicates` rather than a read-then-insert, because the read and the insert are two
   * statements and a four-tab screen is exactly where two of them interleave.
   *
   * `revive` is the whole tombstone contract, in one flag, passed explicitly rather than
   * inferred from `source` — the two happen to line up today (the operator's tick revives,
   * the seed's insert does not) and a reader should not have to know that to see which way
   * this goes. With it false, a detached row is left detached and the caller is told
   * `'already'`: that is what stops `npm run seed:blueprints` reviving an ask an operator
   * removed. With it true, the row comes back and keeps its stored `source` — provenance is
   * who AUTHORED the ask, and re-ticking a blueprint's ask does not make the operator its
   * author.
   */
  async addAsk(args: {
    productId: string;
    factId: string;
    source: SurrogateAskSource;
    createdBy: string | null;
    revive: boolean;
  }): Promise<'added' | 'revived' | 'already'> {
    const result = await this.prisma.surrogateProductAsk.createMany({
      data: [
        {
          productId: args.productId,
          factId: args.factId,
          source: args.source,
          createdBy: args.createdBy,
        },
      ],
      skipDuplicates: true,
    });
    if (result.count > 0) return 'added';
    if (!args.revive) return 'already';
    const revived = await this.prisma.surrogateProductAsk.updateMany({
      where: { productId: args.productId, factId: args.factId, detachedAt: { not: null } },
      data: { detachedAt: null, detachedBy: null },
    });
    return revived.count > 0 ? 'revived' : 'already';
  }

  /**
   * The same insert, addressed by KEYS.
   *
   * Both ends are resolved here through the registry's own `(type, key)` unique, so no
   * caller has to hold an enumeration id to record an ask — and neither the seed pass nor
   * the ask door ends up with its own copy of that lookup. Returns `'missing'` when either
   * row is absent, which the seed reports as drift rather than treating as a write.
   */
  async addAskByKeys(args: {
    productKey: string;
    factKey: string;
    source: SurrogateAskSource;
    createdBy: string | null;
    /** See `addAsk`. The seed passes `false`; the operator's tick passes `true`. */
    revive: boolean;
  }): Promise<'added' | 'revived' | 'already' | 'missing'> {
    const [product, fact] = await Promise.all([
      this.prisma.platformEnumeration.findUnique({
        where: {
          idx_platform_enumeration_type_key: { type: 'surrogate_product', key: args.productKey },
        },
        select: { id: true },
      }),
      this.prisma.platformEnumeration.findUnique({
        where: {
          idx_platform_enumeration_type_key: { type: 'surrogate_fact', key: args.factKey },
        },
        select: { id: true },
      }),
    ]);
    if (!product || !fact) return 'missing';
    return this.addAsk({
      productId: product.id,
      factId: fact.id,
      source: args.source,
      createdBy: args.createdBy,
      revive: args.revive,
    });
  }

  /** Drop one product's ask, addressed by keys. Returns whether a row was actually there. */
  async removeAskByKeys(productKey: string, factKey: string): Promise<boolean> {
    const ids = await this.askIds(productKey, factKey);
    if (ids === null) return false;
    return this.removeAsk(ids.productId, ids.factId);
  }

  /** Drop one product's ask. Returns whether a row was actually there. */
  async removeAsk(productId: string, factId: string): Promise<boolean> {
    const result = await this.prisma.surrogateProductAsk.deleteMany({
      where: { productId, factId },
    });
    return result.count > 0;
  }

  /**
   * Mark one product's ask removed without deleting the row, addressed by keys.
   *
   * The untick of a `blueprint` ask. The row has to survive or `npm run seed:blueprints`
   * finds nothing to collide with and re-inserts the ask on the next deploy — which is the
   * behaviour the untick refusal used to exist to prevent. Returns whether a LIVE row was
   * there to detach, so a double-click is not reported as a change.
   */
  async tombstoneAskByKeys(args: {
    productKey: string;
    factKey: string;
    detachedBy: string | null;
  }): Promise<boolean> {
    const ids = await this.askIds(args.productKey, args.factKey);
    if (ids === null) return false;
    const result = await this.prisma.surrogateProductAsk.updateMany({
      where: { productId: ids.productId, factId: ids.factId, detachedAt: null },
      data: { detachedAt: new Date(), detachedBy: args.detachedBy },
    });
    return result.count > 0;
  }

  /** Both ends of one ask row, resolved through the registry's `(type, key)` unique. */
  private async askIds(
    productKey: string,
    factKey: string,
  ): Promise<{ productId: string; factId: string } | null> {
    const [product, fact] = await Promise.all([
      this.prisma.platformEnumeration.findUnique({
        where: {
          idx_platform_enumeration_type_key: { type: 'surrogate_product', key: productKey },
        },
        select: { id: true },
      }),
      this.prisma.platformEnumeration.findUnique({
        where: {
          idx_platform_enumeration_type_key: { type: 'surrogate_fact', key: factKey },
        },
        select: { id: true },
      }),
    ]);
    if (!product || !fact) return null;
    return { productId: product.id, factId: fact.id };
  }

  /**
   * Which facts each of MANY products reads, by product key — the catalog board's read.
   *
   * One query for every product on the board rather than one per card: `asksFor` per
   * product is the N+1 the product list used to be built out of.
   */
  async asksByProduct(): Promise<Map<string, ProductAskRow[]>> {
    const rows = await this.prisma.surrogateProductAsk.findMany({
      where: { product: { type: 'surrogate_product' }, detachedAt: null },
      select: {
        source: true,
        fact: { select: { key: true } },
        product: { select: { key: true } },
      },
      orderBy: [{ product: { key: 'asc' } }, { fact: { key: 'asc' } }],
    });
    const byProduct = new Map<string, ProductAskRow[]>();
    for (const row of rows) {
      const list = byProduct.get(row.product.key) ?? [];
      list.push({ productKey: row.product.key, factKey: row.fact.key, source: row.source });
      byProduct.set(row.product.key, list);
    }
    return byProduct;
  }
}

/** Re-exported so callers need not reach into `@prisma/client` for one enum. */
export type { SurrogateAskSource };
export const ASK_SOURCE = {
  blueprint: 'blueprint',
  operator: 'operator',
} as const satisfies Record<SurrogateAskSource, SurrogateAskSource>;
