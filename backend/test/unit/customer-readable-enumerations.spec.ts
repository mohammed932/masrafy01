/**
 * Which enumeration types a CUSTOMER may read.
 *
 * `GET /v1/platform-enumerations/:type` takes the type as a path parameter and, until this
 * list existed, validated nothing: any authenticated customer could name any type and get
 * every active row back, with `Cache-Control: public, max-age=300` on the response.
 *
 * That was survivable while every type held labels a customer sees anyway. It stopped
 * being survivable with `surrogate_product`, whose rows carry `incomeRule` — a bank's cap
 * tables, its band edges, its DBR overrides — one request away from a competitor.
 *
 * The direction is the whole point: an ALLOW-list means the next type someone adds is
 * private until a person decides otherwise. A deny-list would mean public until someone
 * remembers.
 */
import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_READABLE_ENUMERATION_TYPES,
  isCustomerReadableEnumerationType,
} from '@/platform-enumerations/platform-enumerations.repository';

describe('customer-readable enumeration types', () => {
  it('does NOT expose surrogate products — their rows carry bank cap tables', () => {
    expect(isCustomerReadableEnumerationType('surrogate_product')).toBe(false);
  });

  it('does not expose the fact registry either', () => {
    // `surrogate_fact` members carry `boundQuestion` with its full option list and the
    // derived parent lists. Nothing in the app reads it; it should not be reachable.
    expect(isCustomerReadableEnumerationType('surrogate_fact')).toBe(false);
  });

  it('exposes exactly what the Flutter client names, and nothing else', () => {
    // `EnumerationTypes` in `platform_enumerations_usecase.dart`. Everything else the app
    // renders reaches it inside the questionnaire snapshot as materialised question
    // options, not through this endpoint.
    expect([...CUSTOMER_READABLE_ENUMERATION_TYPES].sort()).toEqual([
      'governorate',
      'program_name',
      'required_document',
    ]);
  });

  it('refuses an unknown type rather than treating it as absent', () => {
    expect(isCustomerReadableEnumerationType('')).toBe(false);
    expect(isCustomerReadableEnumerationType('compound')).toBe(false);
    expect(isCustomerReadableEnumerationType('../../etc/passwd')).toBe(false);
  });
});
