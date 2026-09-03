/**
 * The `surrogate_product_ask` rows — which facts a no-payslip product reads.
 *
 * WRITES THIS TABLE AND NOTHING ELSE. Every `platform_enumeration` write the ask door
 * performs still goes through `PlatformEnumerationsAdminService`, so the audit event, the
 * cache invalidation and the guards stay one implementation — the convention the product's
 * on/off switch already follows. A second, quieter write path would be a second set of
 * rules, free to disagree with the first about what is allowed.
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
      where: { product: { type: 'surrogate_product', key: productKey } },
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
      where: { fact: { type: 'surrogate_fact', key: factKey } },
      select: { product: { select: { key: true } } },
      orderBy: { product: { key: 'asc' } },
    });
    return rows.map((row) => row.product.key);
  }

  /** Ask sets for many products at once — the board's "who else reads this" in one query. */
  async asksForFacts(factKeys: readonly string[]): Promise<Map<string, string[]>> {
    if (factKeys.length === 0) return new Map();
    const rows = await this.prisma.surrogateProductAsk.findMany({
      where: { fact: { type: 'surrogate_fact', key: { in: [...factKeys] } } },
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
   * statements and a four-tab screen is exactly where two of them interleave. Returns
   * whether the row is NEW, which is what decides whether anything is audited.
   */
  async addAsk(args: {
    productId: string;
    factId: string;
    source: SurrogateAskSource;
    createdBy: string | null;
  }): Promise<boolean> {
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
    return result.count > 0;
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
  }): Promise<'added' | 'already' | 'missing'> {
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
    const added = await this.addAsk({
      productId: product.id,
      factId: fact.id,
      source: args.source,
      createdBy: args.createdBy,
    });
    return added ? 'added' : 'already';
  }

  /** Drop one product's ask, addressed by keys. Returns whether a row was actually there. */
  async removeAskByKeys(productKey: string, factKey: string): Promise<boolean> {
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
    if (!product || !fact) return false;
    return this.removeAsk(product.id, fact.id);
  }

  /** Drop one product's ask. Returns whether a row was actually there. */
  async removeAsk(productId: string, factId: string): Promise<boolean> {
    const result = await this.prisma.surrogateProductAsk.deleteMany({
      where: { productId, factId },
    });
    return result.count > 0;
  }

  /**
   * Which facts each of MANY products reads, by product key — the catalog board's read.
   *
   * One query for every product on the board rather than one per card: `asksFor` per
   * product is the N+1 the product list used to be built out of.
   */
  async asksByProduct(): Promise<Map<string, ProductAskRow[]>> {
    const rows = await this.prisma.surrogateProductAsk.findMany({
      where: { product: { type: 'surrogate_product' } },
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
