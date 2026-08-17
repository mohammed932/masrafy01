-- Five new program-name archetypes — step 2 of 5. Still nothing reads the rule.
--
-- The five programs that carry a real income table are all filed under a name
-- that does not describe them: ABK's professors, ABK's practice-owning doctors and
-- the Sales Floor's self-employed program are all `professional` or `doctor`,
-- alongside programs that just read a payslip. The rule cannot move onto the name
-- until the name says what the archetype IS, so these five come first and the
-- re-point (step 4) follows.
--
--   professor        university teaching staff, paid by academic rank
--   doctor_practice  a doctor who OWNS the clinic — no employer, no payslip
--   self_employed    business owners underwritten on bank statements
--   athlete          professional athletes (club contract, so a payslip exists)
--   wealth_tier      the affluent-tier programs (declared income, qualitative review)
--
-- WHY A MIGRATION AND NOT THE SEED. `prisma/seed-program-catalog.ts` reconciles
-- categories, question templates and the income basis for names that ALREADY
-- exist — a matrix key with no catalog row is skipped with
-- `program_name '<key>' not in the catalog — skipped`. It never creates one. Steps
-- 3, 4 and 5 all address these rows by key, and so does every environment that
-- deploys this branch, so their existence has to be a schema-history fact and not
-- the outcome of an optional script somebody may not have run.
--
-- Ids are DERIVED FROM THE KEY — `'pn_' || substr(md5(key), 1, 24)` — which is the
-- second id convention `20260724130000_program_name_enumeration` established, in
-- its backfill half, and the correct one here.
--
-- The other convention, the hand-numbered `clpepn##` block, was tried first and is
-- wrong for a name added on a branch: the sequence has moved on since that
-- migration (`clpepn16` is `pharmacy`, claimed by a later one), so continuing it
-- collides on the PRIMARY KEY — and `ON CONFLICT ("type","key")` does not catch a
-- PK collision, so the migration aborts rather than skipping. A derived id cannot
-- collide with a name that is not this name, is stable across every environment,
-- and needs no coordination with whatever else lands in the same release.
--
-- `parentKey` is NOT set — deliberately omitted, not written as NULL by accident.
-- `20260807090000_clear_program_name_parent_key` cleared it for every
-- `program_name`: the single-parent scope was replaced by the many-to-many
-- assignment in `platform_enumeration_loan_category`, and re-introducing it would
-- re-create the ambiguity that migration removed.
--
-- Idempotent throughout: `ON CONFLICT ("type","key") DO NOTHING` so a re-run never
-- overwrites a label an operator has since edited.

-- ===========================================================================
-- 1) The names
-- ===========================================================================
INSERT INTO "platform_enumeration"
    ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
SELECT 'pn_' || substr(md5(v.key), 1, 24),
       'program_name', v.key, v.label_ar, v.label_en, true, false, v.sort_order, now(), now()
FROM (VALUES
    ('professor',       'أساتذة الجامعات',      'University Professors',          10),
    ('doctor_practice', 'أطباء أصحاب عيادات',   'Doctors — Own Practice',         11),
    ('self_employed',   'أصحاب الأعمال الحرة',  'Self-Employed / Business Owner', 12),
    ('athlete',         'الرياضيون المحترفون',  'Professional Athletes',          13),
    ('wealth_tier',     'شريحة الثروات',        'Wealth — Affluent Tier',         14)
) AS v(key, label_ar, label_en, sort_order)
ON CONFLICT ("type","key") DO NOTHING;

-- ===========================================================================
-- 2) Which loan categories each name is OFFERED under, and on which basis
-- ===========================================================================
-- A name with no row here is PARKED: bank-program create/update rejects the pair
-- with PROGRAM_NAME_KEY_NOT_IN_CATEGORY, so step 4's re-point would fail on every
-- program whose category is not assigned here first.
--
-- `payslip` / `noPayslip`: EXACTLY ONE is true per pair. The catalog states one
-- basis per (name, category) since v16.5.0 — it answers "what is this name FOR",
-- and that has one answer. It does NOT constrain a bank: `bank_program.programType`
-- is the only authority on how a bank actually sells the name, and the two are
-- allowed to disagree (v16.4.1).
--
-- The values are the ones `prisma/data/program-catalog-matrix.ts#catalogIncomeBasis`
-- derives, restated here because the seed cannot reach rows it did not create:
--   * `business` is never a payslip product      → self_employed/business = no payslip
--   * a self-employed archetype carries its basis across every category it reaches
--     (a doctor financing a car is still a doctor) → doctor_practice, self_employed
--   * a name with a curated no-payslip FACT sells the PERSONAL product that way and
--     the ordinary way elsewhere → professor: personal off academic rank, car and
--     mortgage off the university's payroll certificate
--   * athlete and wealth_tier have no such fact — a club contract and a wealth-tier
--     salary are both documented, so both are payslip everywhere they are offered.
--
-- The enumeration id is looked up by (type, key) rather than typed as a literal, so
-- this is correct even where the name already existed under a different id (a
-- backfilled row from `20260724130000_program_name_enumeration`, say).
INSERT INTO "platform_enumeration_loan_category"
    ("enumerationId","category","payslip","noPayslip")
SELECT pe."id", v.category::"LoanCategory", v.payslip, v.no_payslip
FROM (VALUES
    ('professor',       'personal', false, true ),
    ('professor',       'car',      true,  false),
    ('professor',       'mortgage', true,  false),
    ('doctor_practice', 'personal', false, true ),
    ('doctor_practice', 'car',      false, true ),
    ('doctor_practice', 'mortgage', false, true ),
    ('doctor_practice', 'business', false, true ),
    ('self_employed',   'personal', false, true ),
    ('self_employed',   'car',      false, true ),
    ('self_employed',   'business', false, true ),
    ('athlete',         'personal', true,  false),
    ('athlete',         'car',      true,  false),
    ('wealth_tier',     'personal', true,  false),
    ('wealth_tier',     'car',      true,  false),
    ('wealth_tier',     'mortgage', true,  false)
) AS v(key, category, payslip, no_payslip)
JOIN "platform_enumeration" pe
  ON pe."type" = 'program_name' AND pe."key" = v.key
ON CONFLICT DO NOTHING;
