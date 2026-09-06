/**
 * `capShapeOf` — the maximum-loan GRID a surrogate product implies.
 *
 * The three properties pinned here are the three the callers depend on and none of which is
 * visible at the call site:
 *
 *   · it resolves by PRODUCT key, which is what a catalog name links to and what every
 *     admin screen addresses a product by;
 *   · it resolves by BLUEPRINT key as a fallback, which is the only thing left once an
 *     operator has renamed a product — `seedProductKey` writes the blueprint key verbatim,
 *     so the two are the same string on every seeded row and differ only after a rename;
 *   · the object it hands back is FROZEN. The registry is a module singleton, so a caller
 *     that sorted `rowKeys` in place would reorder the grid for every later request in the
 *     process — a defect that shows up as a different screen for the next operator and
 *     never in the request that caused it.
 */

import { describe, expect, it } from 'vitest';
import {
  capShapeOf,
  productBlueprints,
} from '../../src/bank-programs/blueprints/product-blueprints';

/** A blueprint that really does declare a cap, taken from the registry rather than named. */
const WITH_CAP = productBlueprints().find((blueprint) => blueprint.cap !== undefined);

describe('capShapeOf', () => {
  it('resolves a cap by the product key', () => {
    expect(WITH_CAP).toBeDefined();
    const key = WITH_CAP?.key as string;
    expect(capShapeOf(key)).toEqual(WITH_CAP?.cap);
  });

  it('resolves it by the BLUEPRINT key when the product has been renamed', () => {
    // The product key is what the operator changed; the blueprint key is what
    // `templateSpec.blueprintKey` still carries, and it is the only way back to the grid.
    const key = WITH_CAP?.key as string;
    expect(capShapeOf('renamed_by_an_operator', key)).toEqual(WITH_CAP?.cap);
  });

  it('answers undefined for a key nothing declares', () => {
    expect(capShapeOf('no_such_product')).toBeUndefined();
    expect(capShapeOf('no_such_product', 'no_such_blueprint')).toBeUndefined();
    // A renamed product whose blueprint key is also unknown: the fallback must not resolve
    // to some other product's grid just because one of the two lookups missed.
    expect(capShapeOf('no_such_product', null)).toBeUndefined();
  });

  it('answers undefined for a product that declares no cap', () => {
    const noCap = productBlueprints().find((blueprint) => blueprint.cap === undefined);
    expect(noCap).toBeDefined();
    expect(capShapeOf(noCap?.key as string)).toBeUndefined();
  });

  it('hands back a frozen copy — the registry cannot be reordered through it', () => {
    const shape = capShapeOf(WITH_CAP?.key as string);
    expect(shape).toBeDefined();
    if (shape === undefined) return;
    expect(Object.isFrozen(shape)).toBe(true);
    // Module code is strict mode, so a write to a frozen object throws rather than being
    // silently dropped — which is the whole point: a silent drop would leave the caller
    // believing it had sorted the list.
    expect(() => {
      (shape as { onNoMatch: string }).onNoMatch = 'reject';
    }).toThrow(TypeError);
    if (shape.rowKeys) {
      expect(Object.isFrozen(shape.rowKeys)).toBe(true);
      expect(() => shape.rowKeys?.push('injected')).toThrow(TypeError);
    }
    if (shape.columnKeys) {
      expect(() => shape.columnKeys?.push('injected')).toThrow(TypeError);
    }
    if (shape.bands) {
      expect(Object.isFrozen(shape.bands)).toBe(true);
      expect(() => {
        const band = shape.bands?.[0];
        if (band) band.fromInclusive = '0';
      }).toThrow(TypeError);
    }
  });

  it('is a COPY — freezing it did not freeze the registry entry itself', () => {
    // Two reads must not be the same object: freezing the blueprint's own `cap` in place
    // would be a side effect of reading it, and the next test to mutate a fixture would
    // fail somewhere else entirely.
    const key = WITH_CAP?.key as string;
    expect(capShapeOf(key)).not.toBe(WITH_CAP?.cap);
    expect(capShapeOf(key)).not.toBe(capShapeOf(key));
  });
});
