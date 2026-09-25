# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two distinct audiences:

1. **Retail borrowers (customers)** in Egypt, ages 25–50, ranging from financially savvy to non-expert, who need a personal/car/mortgage/business loan and want to compare offers across banks without wading through jargon or hidden fees. They use the Flutter mobile app — currently deferred, awaiting Figma, not under active design.
2. **Masrafy's own operations team** (bank-program configurators, sales agents/managers, document-review and support staff) who sign into the Angular admin dashboard daily to configure bank programs, the shared customer questionnaire, loan income-calculation rules, applications, and support tickets. This is the surface currently under active design and the one the attached reference screenshots belong to.

## Product Purpose

Masrafy is a loan-comparison marketplace for Egypt: a customer answers a guided questionnaire once, the matching engine prices every active bank program against their profile, and the customer compares offers side-by-side (rate, installment, fees, required documents) before applying — entirely inside the app. Success is measured from "I need money" to "Application Completed," not merely sign-in. The admin dashboard is the operational backbone: staff configure which banks, programs, income-calculation rules, and questions exist so the customer-facing comparison stays accurate.

## Positioning

"A supermarket for banks": Masrafy is the only comparison layer that shows every eligible bank offer for a customer's profile in one place, including offers from banks that compete with each other — no competitor collects across banks. The differentiator is transparency (effective rate, monthly installment, every fee line, and every required document shown up front, before applying) plus breadth (20+ bank programs across four loan categories), not a single-product vertical app.

## Operating Context

- **Customer flow**: guided multi-step questionnaire → eligibility/profile analysis → ranked, comparable offers → in-app apply → document upload → application tracked to a decision.
- **Admin flow** (the surface under active design): operations staff sign into the Angular dashboard to add/edit/clone/toggle bank programs, author the shared question pool and its per-category assignment, configure how a bank works out income for a "no payslip" (surrogate) product, manage lookups/enumerations, review applications and documents, and handle support tickets.
- The admin is an **internal, expert-operated tool** used daily by a small ops team — not a customer-facing marketing surface.
- Egypt-specific financial domain: 20+ partner banks, four loan categories (personal, car, mortgage, business), Arabic-primary / English-secondary UI, RTL layout required throughout.

## Capabilities and Constraints

- Three codebases under one constitution: NestJS 10 + Prisma 5 + PostgreSQL 16 backend (active); Angular 18 + ng-zorro-antd admin dashboard (active, azure-blue `#0869C3` brand); Flutter mobile app (deferred, awaiting Figma).
- Exactly four retail loan categories, scope-locked by the constitution: personal, car, mortgage, business — adding a fifth needs a constitution amendment.
- The platform is free for customers; Masrafy earns commission from banks (1–2% personal, 0.5–1% mortgage, flat fee per activated card).
- Money is always `Decimal`, never float (constitutional, non-negotiable).
- No approval "score" or probability is shown anywhere (removed platform-wide — a % match/score was found to be unfounded marketing, not a real risk assessment).
- A bank program may price a customer against a declared payslip OR against a "surrogate" fact (e.g. a pledged deposit, a car's down payment, a professional grade) — this dual mechanism is central to the admin's program-catalog / surrogate-product screens, which is what the attached reference screenshots show.
- Arabic is the primary locale; every user-facing string ships through the i18n pipeline in both locales, RTL is a first-class layout requirement.
- ng-zorro-antd is the one UI library for the admin — no Angular Material, no ad-hoc component libraries.

## Brand Commitments

- Public brand name: **Masrafy** / مصرفي. Internal/engineering name: **Credit Match**.
- Primary brand color: azure blue `#0869C3`, defined as a design token (`admin/src/styles/_tokens.scss`), used project-wide.
- Voice: plain-language, non-condescending explanation of financial products for a mixed-expertise audience; "no surprises" — every fee and requirement shown before commitment.

## Evidence on Hand

- `BUSINESS_PLAN.md` (project root) — canonical business context: user journey, target audience, product lines, admin-surface scope, competitive positioning.
- `CLAUDE.md` (project root) — the full constitution: every binding architectural/UX/brand rule and a detailed dated changelog of every shipped admin/backend feature, including the exact mechanism the reference screenshots belong to (surrogate income-rule products, e.g. `down_payment_income`).
- Two user-provided PDF exports of the live admin screen `/program-catalog/products/down_payment_income`, flagged by the user as over-engineered and too detailed for what it needs to communicate — the working reference for the next simplification pass.
- No customer testimonials, case studies, or press exist yet; do not fabricate any.

## Product Principles

1. Comparison over single-product selling — always show every eligible bank offer together, never funnel toward one.
2. No surprises — rate, installment, every fee, and every required document are shown before the customer commits.
3. Free for the customer, monetized via bank commission — never design a paywall or customer-facing charge.
4. Banks are data, not code — no hardcoded per-bank branching; every bank/program/question/income-rule is admin-configurable.
5. Expert detail stays one tap deeper — the default view is simple for a non-expert audience; power-user/operator detail is available but never forced on first view.

## Accessibility & Inclusion

- Arabic (primary) + English (secondary) with full RTL support — logical CSS properties only, never hardcoded left/right.
- Target end-user age range 25–50 spans both financially fluent and non-fluent users — default UI must simplify without being condescending; no formal WCAG level is asserted in project docs.
