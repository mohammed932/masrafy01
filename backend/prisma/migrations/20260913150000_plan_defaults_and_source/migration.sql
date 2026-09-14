-- The PLAN tables a surrogate product hands down, and the one field that decides whose apply.
--
-- A plan is one row of a bank's auto card: "20% down -> 10% a year, 6-60 months, we finance
-- 80%, and not under a million". Four figures against one axis, each already a
-- `FactGridConfig` the engine prices from today. Nothing here is a new mechanism; these two
-- columns decide which COPY of those tables a programme reads.
--
-- ADDITIVE, NULLABLE, AND NOTHING IS BACKFILLED. Measured before deploy: 0 of 12
-- `surrogate_product` rows would carry `planDefaults`, and 0 of 36 `bank_program` rows carry
-- a rate, term-floor, financed-share or amount-floor grid. `plansSource` is NULL on every
-- row and NULL reads as `'own'`, so every programme on this database goes on reading exactly
-- the figures it reads now.
--
-- WHY A SELECTOR AND NOT "BLANK INHERITS". `tenorDefaults` is inherited by absence, and that
-- was safe because `tenor.minMonths`/`maxMonths` were both REQUIRED until v29.1.0 — "states
-- neither" was unreachable and could be given a new meaning for free. The grids are not in
-- that position. `tenor.maxMonthsByFact` is optional TODAY and a blank one already means
-- something; its own docstring says "a blank grid there is a stated 'this bank does not cap
-- by that', not 'nobody has said yet'". Inheriting by absence would mean that the first table
-- an operator types on a product silently hands every programme under it a ceiling it never
-- had, with no screen having said so. `plansSource` is the same shape as
-- `incomeAssumption.amounts`: it does not describe the tables, it selects whose apply.
--
-- WHY THE SELECTOR IS ON `bank_program` AND NOT INSIDE A BLOB. The four tables live in THREE
-- different JSON columns (`pricing`, `tenor`, `loanLimits`). A key inside any one of them
-- would be a statement about the other two made in the wrong place, and `carriedKeysOf` on
-- the wizard would have to learn it three times.
--
-- WHY `planDefaults` IS ITS OWN COLUMN. Not `incomeRule` -- that blob is
-- `IncomeAssumptionConfig`, read by the income RESOLVER, and a rate is not a statement about
-- income. Not `capDefaults`, whose whole contract is that it is COPIED ONCE at programme
-- create: these are read live, so one column would mean two mechanisms. Not `tenorDefaults`,
-- which is two integers with no axes and no `onNoMatch`.
--
-- No quote moves when this lands.
ALTER TABLE "platform_enumeration" ADD COLUMN "planDefaults" JSONB;
ALTER TABLE "bank_program" ADD COLUMN "plansSource" VARCHAR(16);

DO $$
DECLARE
  products integer;
  programs integer;
BEGIN
  SELECT count(*) INTO products
    FROM "platform_enumeration" WHERE "planDefaults" IS NOT NULL;
  SELECT count(*) INTO programs
    FROM "bank_program" WHERE "plansSource" IS NOT NULL;

  -- Both are zero by construction of an ADD COLUMN with no default. Asserted rather than
  -- assumed because the whole "no quote moves" claim above rests on it: a non-NULL row here
  -- would be a programme reading somebody else's figures from the instant this lands.
  IF products <> 0 OR programs <> 0 THEN
    RAISE EXCEPTION 'plan_defaults_and_source: expected 0 products and 0 programmes to carry the new columns, found % and %', products, programs;
  END IF;

  RAISE NOTICE 'plan_defaults_and_source: columns added; 0 products state plans and 0 programmes read them (absent plansSource = own)';
END $$;

-- ─── The one product that states plans, written HERE and not left to the seed ────────────
--
-- WHY THIS IS IN A MIGRATION AT ALL. The collapse that follows it
-- (`20260913160000_scb_down_payment_one_programme`) refuses to delete the five down-payment
-- tiers unless the product already states the financed-share table that replaces them — which
-- is right: deleting five programmes whose policy has nowhere to live is how a figure goes
-- missing. But `planDefaults` is written by `seed:sheet-figures`, the seed runs AFTER the
-- build, the build runs after `migrate deploy`, and `migrate deploy` applies both migrations
-- in one pass with no way to stop between them. A fresh database escapes (no tiers, the
-- collapse returns early); every database that actually HAS the five tiers — which is the
-- only kind this migration exists for — aborts the deploy and leaves Prisma with a failed
-- migration blocking every later one.
--
-- So the product states its plans one migration EARLIER than the collapse needs them. This is
-- the v27.1.0 precedent, quoted: "pasted, so there is NO window in which ... the doctors
-- precedent accepted that window; this one did not have to."
--
-- WHY IT IS SAFE TO PASTE A FIGURE HERE, given the header above says nothing is backfilled.
-- Nothing that QUOTES changes. A programme reads these tables only when it says so, and
-- `plansSource` is NULL on every row at this point in the file — absent reads as `'own'`
-- (`plan-inherit.ts`), so at the end of this migration exactly zero programmes read them. The
-- column is inert until the collapse names a reader.
--
-- WHY NOT A DIFFERENT TABLE. This is not one bank's policy leaking onto every other
-- (Principle II / A1): the five shares, the five rates and the floor below come off ONE bank's
-- own card, and they are being moved from five rows of that bank's own programmes onto the
-- product those five programmes are the only members of. No other bank sells this product.
--
-- IDEMPOTENT, and deliberately only ever writes a product that states NOTHING: a re-run, or a
-- database where an operator has already typed their own tables, is untouched. The blob is
-- byte-identical to `CATALOG_FIGURES.down_payment_income.planDefaults`
-- (`backend/src/bank-programs/demo-figures/sheet-figures.ts`), which is what makes the seed
-- report 0 written afterwards — and that report is the proof the two agree.
--
-- EVERY FIGURE BELOW IS AN ILLUSTRATION. No Suez Canal slide publishes a profit rate.
UPDATE "platform_enumeration"
   SET "planDefaults" = $plans$
{
  "rateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "car_origin"
      },
      {
        "factKey": "car_fuel_type"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          null
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          {
            "key": "china"
          },
          null
        ],
        "value": "12"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          {
            "key": "electric"
          }
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          {
            "key": "hybrid"
          }
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          {
            "key": "china"
          },
          null
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          {
            "key": "electric"
          }
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          {
            "key": "hybrid"
          }
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          {
            "key": "china"
          },
          null
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          {
            "key": "electric"
          }
        ],
        "value": "7"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          {
            "key": "hybrid"
          }
        ],
        "value": "7"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null
        ],
        "value": "7"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          {
            "key": "china"
          },
          null
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          {
            "key": "electric"
          }
        ],
        "value": "6"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          {
            "key": "hybrid"
          }
        ],
        "value": "6"
      },
      {
        "keys": [
          {
            "fromInclusive": "60",
            "toExclusive": null
          },
          null,
          null
        ],
        "value": "6"
      },
      {
        "keys": [
          {
            "fromInclusive": "60",
            "toExclusive": null
          },
          {
            "key": "china"
          },
          null
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "60",
            "toExclusive": null
          },
          null,
          {
            "key": "electric"
          }
        ],
        "value": "5"
      },
      {
        "keys": [
          {
            "fromInclusive": "60",
            "toExclusive": null
          },
          null,
          {
            "key": "hybrid"
          }
        ],
        "value": "5"
      }
    ],
    "onNoMatch": "reject"
  },
  "ltvCeilingByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "home_ownership"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          {
            "key": "owned_by_me"
          }
        ],
        "value": "80"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          {
            "key": "owned_by_relative"
          }
        ],
        "value": "80"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null
        ],
        "value": "70"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null
        ],
        "value": "50"
      },
      {
        "keys": [
          {
            "fromInclusive": "60",
            "toExclusive": null
          },
          null
        ],
        "value": "40"
      }
    ],
    "onNoMatch": "reject"
  },
  "maxMonthsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          }
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          }
        ],
        "value": "72"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": null
          }
        ],
        "value": "84"
      }
    ],
    "onNoMatch": "useFallback"
  },
  "minAmountByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          }
        ],
        "value": "1000000"
      }
    ],
    "onNoMatch": "useFallback"
  }
}
$plans$::jsonb,
       "updatedAt" = now()
 WHERE "type" = 'surrogate_product'
   AND "key" = 'down_payment_income'
   AND "planDefaults" IS NULL;

DO $$
DECLARE
  slots   integer;
  readers integer;
BEGIN
  -- The product may legitimately not exist yet (a database seeded from nothing runs
  -- `seed:blueprints` after this), in which case there is nothing to assert and nothing to
  -- collapse either. Where it DOES exist, the collapse one file later depends on exactly one
  -- thing, so that is the thing asserted.
  IF NOT EXISTS (SELECT 1 FROM "platform_enumeration"
                  WHERE "type" = 'surrogate_product' AND "key" = 'down_payment_income') THEN
    RAISE NOTICE 'plan_defaults_and_source: down_payment_income does not exist yet — seeds will create it with its plans';
    RETURN;
  END IF;

  SELECT count(*) INTO slots
    FROM "platform_enumeration"
   WHERE "type" = 'surrogate_product' AND "key" = 'down_payment_income'
     AND "planDefaults" ? 'ltvCeilingByFact'
     AND "planDefaults" ? 'rateByFact';
  IF slots <> 1 THEN
    RAISE EXCEPTION 'plan_defaults_and_source: down_payment_income states no financed-share or rate plan table after this migration — the collapse that follows would refuse';
  END IF;

  -- REPORTED, not asserted as zero. It IS zero on the upgrade this file is written for —
  -- nothing sets `plansSource` until the collapse — but it is 1 on a database that has
  -- already collapsed and is re-running, and a notice that states a number it has not
  -- counted is how a re-run starts looking like a fresh one.
  SELECT count(*) INTO readers FROM "bank_program" WHERE "plansSource" = 'product';
  RAISE NOTICE 'plan_defaults_and_source: down_payment_income states its plan tables; % programme(s) currently read them', readers;
END $$;
