/**
 * THE DOOR v22.0.0 CLOSED, and the narrow one this change opens beside it.
 *
 * v22.0.0's decision was that a no-payslip PRODUCT is seeded, never created — the three
 * admin screens that used to mint products and facts of their own each produced a row
 * nothing seeded and no blueprint described. This change reopens fact creation for ONE
 * caller, and these are the assertions that prove nothing else moved: the generic
 * `POST admin/enumerations` still refuses both kinds, the bulk-paste door still refuses
 * both, and the new source reaches facts and NOT products.
 *
 * Exercised through the service's own guard rather than over HTTP, because the guard is what
 * every door funnels into: the controller passes a validated body and an actor, and the
 * bypass is a THIRD POSITIONAL argument no wire field can reach.
 */
import { describe, expect, it, vi } from 'vitest';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import type { CreateEnumerationDto } from '@/platform-enumerations/dto/enumeration.dto';

/**
 * The service with nothing behind it.
 *
 * Every case here is refused BEFORE the first read, which is the property being pinned: a
 * closed door must not depend on what is in the database. Any case that got past the guard
 * would fail on a `null` repository, loudly, rather than pass quietly.
 */
function service(): PlatformEnumerationsAdminService {
  return new PlatformEnumerationsAdminService(
    null as never,
    { findByTypeAndKey: vi.fn() } as never,
    null as never,
  );
}

const actor = { staffId: 'staff_1', sourceIp: null };
const dto = (type: string): CreateEnumerationDto =>
  ({ type, key: 'k', labelAr: 'ك', labelEn: 'K' }) as CreateEnumerationDto;

describe('the seeded-only kinds', () => {
  it('refuses a hand-made surrogate product', async () => {
    await expect(service().create(dto('surrogate_product'), actor)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_CREATE_NOT_APPLICABLE,
    });
  });

  it('refuses a hand-made surrogate fact', async () => {
    await expect(service().create(dto('surrogate_fact'), actor)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_CREATE_NOT_APPLICABLE,
    });
  });

  it('refuses a PRODUCT even from the ask door', async () => {
    // The asymmetry that is the whole of v22.0.0's decision surviving here: an operator
    // picks which seeded product this platform sells and what one of them reads, and never
    // mints a product of their own.
    await expect(
      service().create(dto('surrogate_product'), actor, { source: 'product_ask' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.ENUMERATION_CREATE_NOT_APPLICABLE });
  });

  it('lets the ask door past the guard for a FACT', async () => {
    // Reaches the first read (and dies on the null repo), which is exactly what "the guard
    // did not refuse it" looks like from here.
    await expect(
      service().create(dto('surrogate_fact'), actor, { source: 'product_ask' }),
    ).rejects.not.toMatchObject({ code: ERROR_CODES.ENUMERATION_CREATE_NOT_APPLICABLE });
  });

  it('lets the blueprint library past the guard for both kinds', async () => {
    for (const type of ['surrogate_product', 'surrogate_fact']) {
      await expect(
        service().create(dto(type), actor, { source: 'blueprint' }),
      ).rejects.not.toMatchObject({ code: ERROR_CODES.ENUMERATION_CREATE_NOT_APPLICABLE });
    }
  });

  it('leaves an ordinary kind alone', async () => {
    await expect(service().create(dto('governorate'), actor)).rejects.not.toMatchObject({
      code: ERROR_CODES.ENUMERATION_CREATE_NOT_APPLICABLE,
    });
  });
});
