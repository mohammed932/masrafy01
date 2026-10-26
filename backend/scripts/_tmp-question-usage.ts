import { PrismaClient } from '@prisma/client';
import type { LoanCategory } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '../src/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { narrowAskedQuestions } from '../src/questionnaire/validation/question-scope';
import {
  ENGINE_INPUT_QUESTION_CODES,
  programReaders,
} from '../src/questionnaire/validation/engine-contract';
import { BASE_QUESTION_CODES } from '../src/matching/pipeline/base-question-set';

const prisma = new PrismaClient();

interface SnapQ {
  code: string;
  enabledWhen?: unknown;
  categories?: string[];
  optInCategories?: string[];
}

function gateSources(enabledWhen: unknown): string[] {
  if (enabledWhen === null || typeof enabledWhen !== 'object') return [];
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (n === null || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (typeof o.questionCode === 'string') out.push(o.questionCode);
    for (const v of Object.values(o)) if (typeof v === 'object') walk(v);
  };
  walk(enabledWhen);
  return out;
}

async function main(): Promise<void> {
  const repo = new PostgresPlatformEnumerationsRepository(prisma as unknown as PrismaService);
  const version = await prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    orderBy: { versionNumber: 'desc' },
  });
  const snap = version!.snapshot as { groups: { questions: SnapQ[] }[] };
  const all = snap.groups.flatMap((g) => g.questions);

  const offered = await repo.offeredProgramFlows();
  const lockScope = await repo.questionLockScopeFor(null);
  const flows = await Promise.all(
    offered.map(async (f) => ({
      ...f,
      scope: f.programNameKey === null ? null : await repo.narrowingScopeFor(f.programNameKey, f.category),
    })),
  );
  const readers = programReaders({
    flows,
    facts: [],
    platformQuestionCodes: lockScope.platformQuestionCodes,
    amountDerivableFrom: [],
  } as never);

  const servedOn = new Map<string, string[]>();
  for (const f of flows) {
    if (f.programNameKey === null) continue;
    const cat = f.category as LoanCategory;
    const isOptIn = (q: SnapQ): boolean => q.optInCategories?.includes(cat) === true;
    const inCat = all.filter(
      (q) => !Array.isArray(q.categories) || q.categories.includes(cat) || isOptIn(q),
    );
    const d = narrowAskedQuestions(
      inCat.map((q) => ({ code: q.code, enabledWhen: q.enabledWhen ?? null, optIn: isOptIn(q) })),
      f.scope,
    );
    for (const code of d.keep) {
      const l = servedOn.get(code) ?? [];
      l.push(`${cat}/${f.programNameKey}`);
      servedOn.set(code, l);
    }
  }

  const dependents = new Map<string, string[]>();
  for (const q of all) {
    for (const s of gateSources(q.enabledWhen)) {
      dependents.set(s, [...(dependents.get(s) ?? []), q.code]);
    }
  }
  const base = new Set(BASE_QUESTION_CODES);
  const platform = new Set(lockScope.platformQuestionCodes);
  console.log('flows', flows.length, 'named', flows.filter((f) => f.programNameKey).length);
  for (const q of all) {
    const tags: string[] = [];
    if (base.has(q.code)) tags.push('BASE');
    if (ENGINE_INPUT_QUESTION_CODES.has(q.code)) tags.push('ENGINE');
    if (platform.has(q.code)) tags.push('PLATFORM');
    const r = readers.get(q.code);
    if (r) tags.push(`PROG[${r.map((x) => x.programNameKey).join(',')}]`);
    const deps = dependents.get(q.code);
    if (deps) tags.push(`GATES[${deps.join(',')}]`);
    const served = servedOn.get(q.code) ?? [];
    console.log(
      [q.code, `served=${served.length}`, `cats=${(q.categories ?? []).join(',')}${q.optInCategories?.length ? ' opt=' + q.optInCategories.join(',') : ''}`, tags.join(' ') || '— NOTHING READS'].join(' | '),
    );
    if (served.length > 0 && served.length <= 6) console.log('     on:', served.join(' '));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
