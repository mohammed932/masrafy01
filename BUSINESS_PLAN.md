# Masrafy — Business Plan

> Internal name: **Credit Match**. Public brand: **مصرفي / Masrafy**. Egyptian
> fintech loan-comparison marketplace. Document target: AI assistants
> (Claude) and engineers joining the codebase; treat as the canonical
> business-context companion to `CLAUDE.md` (tech rules) and
> `.specify/memory/constitution.md` (architectural rules).

---

## 1. Introduction

Masrafy is a financial application that helps users in Egypt:

- Enter their financial data through a guided questionnaire.
- Get an analysis of their eligibility profile.
- View the best loan and mortgage offers tailored to that profile.
- Compare offers side-by-side (rate, monthly installment, fees,
  total cost, required documents).
- Apply directly inside the app for the offer they choose.

**Goal:** convert the user from "I need money" to "Application
Completed" — the application is the moment a bank receives the
customer's intent, not just the moment they sign in.

---

## 2. Business Overview

### What we do

A fintech platform sitting between banks / financing companies and
people who want loans or investment products (deposits, certificates,
etc.). We help users choose the best banking and financing solution
based on their personal data — loans and mortgages today, deposits and
certificates later — simply and quickly.

### How we make money

Commission from banks and financing companies on successful loans:

- Personal loans: 1–2% of principal.
- Mortgages: 0.5–1% of principal.
- Credit cards: flat fee per activated card.

The platform is **free for users**. We never charge a customer. This is
binding and is reinforced in the constitution (Project Context).

### Problem we solve

Egyptian consumers struggle with:

- Complicated bank-loan conditions.
- Too many options across too many banks.
- Poor or jargon-heavy explanations on bank websites and from call
  centers.

Masrafy analyses user data and surfaces a clear recommendation for the
best-suited option instead of leaving the user lost between banks.
Through the app, users can apply for loans with monthly installments,
the effective rate and every fee shown clearly, ordered by what the user
said matters most to them. Crucially, **the user can compare offers from
multiple banks in one place** — something none of the competitors offer.

> **No approval probability.** Constitution v25.0.0 removed the approval
> score platform-wide: it was a weighted sum of admin-typed figures never
> once compared against a real bank decision. Re-introducing one under any
> name needs a constitution amendment (A33).

We also explain every procedure and arrange the process on the user's
behalf. Transparency + comparison + a recommendation ordered by the
user's own priority are our wedge.

### Competition

- **Banks themselves** — via their own websites + customer-service
  lines.
- **Financing companies** — single-product specialists.
- **Financial apps** (e.g., valU, driftech) — focus on a single product
  vertical and do not provide comprehensive comparisons or personalised
  consultations per customer.

> Every competitor works only for itself. Masrafy works with everyone —
> including the competitors. The mental model is **a supermarket for
> banks**: the consumer walks in, sees every option, and picks the one
> that fits, guided by recommendations.

### Top user concerns (recurring research findings)

- Ambiguity. Users fear the bank will impose obligations they did not
  see at sign-up time.
- Hidden fees and surprise penalty rates.
- The contradiction between "advertised rate" and "rate actually
  applied to me".

Masrafy's UI shows the effective rate, the monthly installment, every
fee line, and every required document at the time the offer is
presented — before the user applies. **No surprises.**

---

## 3. Target Audience

- **Age:** 25–50.
- **Awareness:** most users are not fully aware of financial products
  → the app must simplify and educate without being condescending.
- **Mix:** both knowledgeable and non-knowledgeable users. Onboarding
  defaults toward simplification; expert detail (cascade trace,
  qualitative-review badges) is one tap deeper.

---

## 4. Product Lines (Constitution v1.7.0 / Principle II scope-lock)

The platform supports **exactly four retail loan categories**:

1. **Personal loans** — no down payment, mass-market. Lifetime value
   of a good match runs into hundreds of thousands of EGP.
2. **Car loans** — 20–30% down payment. Premium tier above 4M EGP
   gets discounted rates.
3. **Mortgages** — 20%+ down payment, multiple property types and
   construction stages, highest revenue per deal.
4. **Business loans** — SME / professional-use working-capital
   lending. Larger ticket sizes; underwriting policies differ from
   retail (v1.7.0 amendment).

Adjacent products (out of Phase 1):

- **Credit cards** — overdraft / charge product line, **not a loan**.
  Phase 2.
- **Deposits, certificates, account opening** — Phase 2+ future
  services.

> **Adding a fifth retail-loan category requires a constitution
> amendment.** This is a hard rule (Anti-pattern A26). Anything beyond
> the four listed above is a review block until the constitution
> widens the scope-lock.

---

## 5. The User Journey (Phase 1)

### 5.1 Questionnaire — minimum data for a recommendation

Required:

- Monthly salary.
- Job type.
- Amount needed.
- Current loans.
- Most important factor for the user — one of:
  - Lowest installment.
  - Fastest approval.
  - Lowest interest.
  - Least paperwork.

  Live as `priority_factor` ("What matters most to you in a loan?"): a
  fixed question on every program, optional, that orders the offers
  (`rankOffers`). Unanswered, offers are ordered partner bank first, then
  fewest documents. Retired in v31.0.0 and restored 2026-11-01.

Asked but optional / branched:

- Financing type: Personal / Mortgage / Car / Business.
- Repayment period bucket: < 5 years / 5–7 years / more.
- Job-type detail: Government / Private / Business owner / Freelancer.
- Company accreditation status (Yes / No / Don't know).
- Salary-receiving bank.
- Salary transfer capability.
- Current credit-card usage.
- Prior bank rejection.

### 5.2 Phase 2 — after results

If the user applies:

- Name + mobile number.
- National-ID photo (front + back).
- HR letter or salary certificate where available.
- For business owners: ID card, commercial registration / tax card
  (if available), 6-month bank statement.

Users can also contact a Masrafy expert for help via in-app **chat or
call** support.

### 5.3 Application flow Phase 1

Two modes are valid in the stakeholder spec:

- **Show only** — user browses offers anonymously.
- **Show + apply** — user applies in-app after picking an offer.

Both ship behind the same wizard. **There is no guest mode**
(Constitution v3.0.0 / Principle XIII): HMAC was removed platform-wide and
every request after sign-up carries a customer JWT. The questionnaire,
matching and apply are gated on a complete profile (Principle XXXVII).

### 5.4 After offer selection

- **Apply inside the app** — the default path; backend creates an
  application + offer record and transitions it through the admin
  pipeline.
- **Contact sales team** — secondary CTA on every offer detail page.
  Routes through the existing `SupportRequest` channel (`call` or
  `whatsapp`).

### 5.5 Edge cases

- **Not eligible:** *open decision.* Eligibility gating is switched off
  for the MVP (Principle V): every active program in the loan type is
  listed, and a program's limits shape the AMOUNT, never whether it is
  listed. The rules are stored on every program (minimum income, months
  in job, accepted salary transfer, age) but not applied. Bringing them
  back — hidden, or flagged with the friendly copy *"فرص الموافقة ضعيفة
  حاليًا، ولكن يمكننا تحسينها معًا. تواصل مع فريق خدمة العملاء"* and a
  support CTA — needs a constitution amendment (A33).
- **No figures for a program:** the program stays listed with a typed
  reason (e.g. a detail not asked yet, the bank does not finance that
  car, the term runs past the age limit). The `suggestions` list is
  returned empty today.

---

## 6. User Account

Two ways in, both completed by a mandatory profile step (Principle
XXXVII):

- **Phone** — mobile + OTP, then first name, last name, birthday and a
  password.
- **Google** — the only social provider (v11.0.0; Apple was removed),
  then mobile + OTP, first name, last name and birthday.

Customer JWT: 15-minute access + 30-day refresh, rotated with reuse
detection. **No guest mode** — `isGuest`, `mobileClientId` and the claim
endpoint were removed and must not come back (v3.0.0). National ID is
required only when the customer selects an offer.

The mobile app starts on a placeholder screen post-Figma; data + domain
layers (JWT interceptors, secure-storage session persistence,
auth + wizard repositories, typed `*Request` DTOs, `ApiHandler.callApi`
error funnel) are already wired.

---

## 7. Banking Products + Match Engine

### 7.1 Offer attributes shown to the user

- Interest rate.
- Repayment period.
- Monthly installment (PMT formula).
- Fees breakdown (admin fee, stamp duty, life insurance, collateral
  fee, penalty rates).
- Eligibility conditions list.
- Required documents per program.
- Total payable and total cost of credit.
- **FEATURED** chip when the program belongs to a partner bank
  (`Bank.isFeatured`) — used as a final tiebreaker by the ranking
  engine.

### 7.2 Loan-system types

- Installments (default).
- Overdraft.
- Both (Phase 2 — not modeled today).

### 7.3 Foreign currency

The Application DTO carries `requestedCurrency` (EGP/USD/EUR per
registry). Backend matching honours per-program currency support; mobile
defaults to EGP.

### 7.4 Matching logic

The matching engine is the platform's **core IP** (Constitution
Principle V). Outputs:

- Minimum down payment.
- Monthly installment (PMT).
- Debt-Burden Ratio, against each program's own cap (a band table by
  income where the bank states one).
- Maximum loan available.
- Ranked matched programs — sorted by the user's chosen priority, with
  `Bank.isFeatured` as the tiebreaker; the order is frozen on the offer
  (`bank_offer.rankIndex`).
- Required documents per program.

Real Egyptian bank rates range 18.5% to 29% — a 10.5pp spread —
depending on employment type, corporate partnerships, salary-transfer
type, salary-category tier, loan size, credit score, and profession.
Picking the wrong program costs the user hundreds of thousands of EGP
over the loan lifetime. The matching engine is the moat.

> **Data gap (2026-11-01).** The engine can price by salary-transfer type,
> job type, credit score and profession; the live data mostly does not
> yet. Every rate-by-transfer table holds one row, every applicant is
> priced as salaried (operator's call, v30.18.0), and 17 of 71 programs
> state an I-Score table. Real bank rate tables are what turns this
> capability into the moat.

---

## 8. Business Controls (Admin Surface)

Admin (`/admin/...`) lets the operations team:

- **Bank Programs CRUD** — add / edit / clone / toggle bank programs
  per the four scope-locked categories (Phase 1 features 002 + 007).
- **Featured offers / sponsored banks** — `Bank.isFeatured`
  (Phase 1, shipped) boosts the bank's offers in mobile ranking
  tiebreaks. Sponsored banks deferred to Phase 2.
- **Applications kanban** — list / detail / Kanban view of every
  application that passed the user-intent gate (feature 005).
- **Activity timeline** — agent calls, WhatsApp sent, documents
  received, etc.
- **Document review** — agent + customer uploads land in the same S3
  bucket; agents verify, reject, or annotate.
- **Customer accounts** — read-only list of mobile signups (Phase 1).
- **Support tickets** — chat / call / WhatsApp / email channels with
  agent assignment and resolution.
- **Onboarding content CRUD** — operator-managed mobile splash
  screens, AR + EN.
- **Lookups** — manage every platform enumeration (loan_purpose,
  employment_type, transfer_type, etc.).
- **Lead analytics + funnel** — agent leaderboard + Phase-1 funnel
  (catalog → questionnaire → apply → offers viewed → docs uploaded →
  offer selected).

Detailed observability surfaces are governed by Constitution Principle
XXIX (no half updates — every dependent reader of a touched field /
enum / threshold must update in the same PR).

---

## 9. Future Services (Phase 2+)

- Open a bank account inside the app.
- Certificates and time deposits.
- Credit cards.
- Loan-application tracking (post-application admin work — the user
  can see their application's lifecycle in the same app they applied
  in).
- Bank decision dashboards for the admin team.

---

## 10. Architecture Snapshot

Three codebases governed by **one constitution**
(`.specify/memory/constitution.md`):

| Platform | Stack | Audience | Auth | Status |
|---|---|---|---|---|
| **Backend** | NestJS + PostgreSQL 16 + Prisma 5 + Redis 7 | Both clients | JWT (admin + customer) | Active — Phase 1 endpoints shipped |
| **Admin dashboard** | Angular 18 + Signals + standalone + NG-ZORRO (the one UI library) | Internal staff | Admin JWT (15min access + 7-day refresh httpOnly cookie) | Active — features 001–007 + customers + support + onboarding + funnel landed |
| **Mobile app** | Flutter 3.27 + auto_route + flutter_bloc + freezed + get_it + injectable + dio + dartz | Egyptian end users | Customer JWT only (15min access + 30-day refresh, secure-storage); no HMAC | Data + domain layers wired; UI rebuild post-Figma |

Brand color **#0869C3** (azure blue), primary across all surfaces.

---

## 11. Constitution Highlights (binding rules)

- **I.** Money is Decimal — never floats.
- **II.** Bank programs are data, not code; loan-category scope-lock to
  exactly four.
- **III.** Typed errors end-to-end; English error strings never cross
  the API boundary.
- **IV.** Arabic-first i18n, RTL native.
- **V.** Matching engine is the core IP: a pure module, every offer's
  figures from one quote function, order by the user's priority. No
  approval score (removed v25.0.0).
- **VI.** PII protection; logs never carry PII; documents in S3 with
  presigned URLs.
- **VII.** Observability — `X-Correlation-Id` everywhere, structured
  JSON logs.
- **VIII.** Brand identity — `#0869C3` primary.
- **IX–XVI.** Backend rules (feature modules, repository pattern,
  Prisma migrations only, DTO vs Entity, dual auth, API envelope,
  rate limiting).
- **XVII–XXVII.** Angular rules (standalone, signals, new control
  flow, inject(), typed reactive forms, design tokens, lazy guards,
  HTTP discipline).
- **XXVIII.** Flutter architectural foundations.
- **XXIX.** Dependency-aware changes — no half updates across reader
  surfaces.
- **XXX–XXXV.** Mobile code structure + shared widgets (Three-Layer
  Feature Architecture, Cubit + Freezed, Per-Flow Page Library,
  Shared Widget Reuse, Shape-Matched Shimmer, Cross-Feature
  Sub-Feature Reuse).

The full text lives in `.specify/memory/constitution.md`. Anti-patterns
A1–A27 are binding review blocks.

---

## 12. Phase 1 Delivery Status

Already shipped (backend + admin):

- Customer auth (phone + Google sign-up, login / refresh / logout / me).
- Apply endpoint + matching engine (quotes, DBR, fees, priority order).
- User-intent gate (select-offer).
- Bank programs CRUD + tier cascade.
- Banks CRUD + logos + `isFeatured` ranking boost.
- Documents (admin presigned upload + mobile customer presigned upload).
- Support module (mobile contact + request + admin inbox + config).
- Onboarding screens (admin CRUD + mobile GET).
- Funnel telemetry + admin funnel analytics.
- Platform enumerations registry (operator-managed).
- Employment-type expansion (4 spec values: government / private /
  business_owner / freelancer).

In-flight (mobile):

- Data + domain layers complete for auth + wizard features
  (`ApiHandler.callApi`, typed `*Request` DTOs, `Model → Entity`
  mappers, `BaseRemoteDataSource(appNetwork)`,
  `BaseRepository<DataSource>`, `BaseUseCase<Repository>`,
  `@injectable` annotations everywhere).
- Presentation tier intentionally empty until Figma lands.

Deferred to Phase 2:

- Credit cards.
- Sponsored banks.
- Loan-system-type (installments / overdraft).
- Bank-receiving-salary user field.
- Company-accreditation user flag.
- Post-application tracking UI.
- Bank-decision feed.

---

## 13. Quick Pointers for Claude

When the user asks about masrafy, default to this stack of references:

1. **This file** — business intent and product scope.
2. **`CLAUDE.md`** — tech stack, day-to-day rules per platform.
3. **`.specify/memory/constitution.md`** — binding architectural
   principles and anti-patterns.
4. **`specs/00X-...`** — feature specs (001 admin auth, 002 bank
   programs, 003 matching engine, 004 approval probability — superseded
   by v25.0.0, 005 lead management, 007 banks).
5. **`backend/prisma/schema.prisma`** — single source of truth for
   data model.
6. **`/Users/mfathy/.claude/plans/`** — most recent execution plans.

**Always cite a Constitution principle # when blocking a PR.** The
constitution is the appeals court; this business plan is the
description of what we're building and why.
