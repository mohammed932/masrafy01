/**
 * Every value whose CLASS cannot be resolved — the check that would have caught
 * `test_compund` on the day it was made.
 *
 *   npx tsx scripts/dangling-parent-keys.ts        (npm run check:parent-keys)
 *
 * `platform_enumeration.parentKey` carries NO foreign key, deliberately: the reachable
 * unique on the target is the composite `(type, key)`, which a self-FK cannot express
 * without a constant type column. That is the right call and it leaves exactly this gap —
 * nothing in the database stops a class disappearing out from under its children, and the
 * only symptom is `factParentTable` answering `no_matching_row` at quote time, which stops
 * the rule for whoever picked that value.
 *
 * Read-only. Three separately-named problems, because they have three different fixes and
 * lumping them together is how the wrong one gets applied:
 *
 *   UNFILED         `parentKey` is NULL or the empty string
 *                   → file it, or declare a `fallbackParentKey` on the kind so an unfile
 *                     lands somewhere. (`''` is the nastier half: it passes the engine's
 *                     `parentKey IS NOT NULL` filter, so the value LOOKS filed.)
 *   DANGLING        names no row of the parent type at all
 *                   → the class was deleted out from under it. Re-file by explicit key;
 *                     never guess, because guessing is stating a price tier.
 *   RETIRED_PARENT  names a row that exists but is inactive or deprecated
 *                   → the loudest of the three, and the one that is STILL PRICING: the
 *                     engine's parent walk filters the CHILD's active flag and never the
 *                     parent's, so the operator believes the class is gone while quotes go
 *                     on coming off it.
 *
 * Exit code is 0 when clean, 1 when anything is reported, so it can gate a deploy.
 */
import { PrismaClient } from '@prisma/client';

interface Offender {
  type: string;
  key: string;
  labelEn: string;
  parentKey: string | null;
}

function line(o: Offender, parentType: string): string {
  const where = o.parentKey === null ? 'NULL' : o.parentKey === '' ? "'' (empty string)" : o.parentKey;
  return `  ${o.type}.${o.key} — "${o.labelEn}" → ${parentType}.${where}`;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // Only kinds that DECLARE an axis. A value carrying a stray `parentKey` on a kind with
    // no axis is a different problem with a different fix (`resolveParentKey` refuses it on
    // every write now), and reporting it here would send the operator to file something
    // there is nowhere to file.
    const axes = await prisma.enumerationTypeDef.findMany({
      where: { parentTypeKey: { not: null } },
      select: { key: true, parentTypeKey: true },
      orderBy: { key: 'asc' },
    });

    const out: string[] = ['', '[check:parent-keys]', ''];
    const unfiled: string[] = [];
    const dangling: string[] = [];
    const retired: string[] = [];
    let checked = 0;

    for (const axis of axes) {
      const parentType = axis.parentTypeKey as string;
      // Every parent row, not only the live ones: telling a DANGLING key from a
      // RETIRED_PARENT one is the whole reason the two are reported separately.
      const parents = await prisma.platformEnumeration.findMany({
        where: { type: parentType },
        select: { key: true, active: true, deprecatedAt: true },
      });
      const live = new Set(
        parents.filter((p) => p.active && p.deprecatedAt === null).map((p) => p.key),
      );
      const known = new Set(parents.map((p) => p.key));

      const children = await prisma.platformEnumeration.findMany({
        where: { type: axis.key },
        select: { type: true, key: true, labelEn: true, parentKey: true },
        orderBy: { sortOrder: 'asc' },
      });
      checked += children.length;

      for (const child of children) {
        if (child.parentKey === null || child.parentKey === '') {
          unfiled.push(line(child, parentType));
        } else if (!known.has(child.parentKey)) {
          dangling.push(line(child, parentType));
        } else if (!live.has(child.parentKey)) {
          retired.push(line(child, parentType));
        }
      }
    }

    if (unfiled.length > 0) {
      out.push(
        `UNFILED — no class at all (${unfiled.length})`,
        '',
        ...unfiled,
        '    FIX: file each one, or declare a fallbackParentKey on the kind.',
        '',
      );
    }
    if (dangling.length > 0) {
      out.push(
        `DANGLING — names a class that does not exist (${dangling.length})`,
        '',
        ...dangling,
        '    FIX: re-file by explicit key. Never guess — a guess states a price tier.',
        '',
      );
    }
    if (retired.length > 0) {
      out.push(
        `RETIRED_PARENT — names a class that is inactive or deprecated (${retired.length})`,
        '',
        ...retired,
        '    FIX: these are STILL PRICING. Re-file them, or bring the class back.',
        '',
      );
    }

    const total = unfiled.length + dangling.length + retired.length;
    if (total === 0) {
      out.push(
        `clean — ${checked} value(s) across ${axes.length} filed-under list(s) resolve to a live class.`,
        '',
      );
    } else {
      out.push(`${total} problem(s). Each one quotes no_matching_row for whoever picks it.`, '');
    }
    process.stdout.write(out.join('\n'));
    process.exitCode = total === 0 ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
