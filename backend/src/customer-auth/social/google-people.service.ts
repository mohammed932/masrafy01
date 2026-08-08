import { Injectable, Logger } from '@nestjs/common';

const PEOPLE_BIRTHDAYS_URL = 'https://people.googleapis.com/v1/people/me?personFields=birthdays';
const REQUEST_TIMEOUT_MS = 4_000;
/** Sanity bounds on the returned year — a garbage value must not become a birthday. */
const MIN_BIRTH_YEAR = 1900;

interface PeopleDate {
  year?: number;
  month?: number;
  day?: number;
}

interface PeopleBirthday {
  metadata?: { primary?: boolean };
  date?: PeopleDate;
}

interface PeopleResponse {
  resourceName?: string;
  birthdays?: PeopleBirthday[];
}

/** A `PeopleDate` narrowed to a fully-specified, in-range calendar day. */
interface CompleteDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Best-effort birthday enrichment from the Google People API.
 *
 * The ID token carries no birthday claim — it is only reachable through
 * People API with the sensitive `user.birthday.read` scope, which the user
 * grants on the consent screen and which most accounts leave unset or
 * year-less (Google hides the year by default). Every failure mode therefore
 * resolves to `null`: this **never throws**, because a missing birthday is the
 * normal case and must not break sign-in. The customer still confirms or edits
 * the value on the Complete-Profile screen before it is submitted.
 *
 * The caller passes the OAuth **access token** obtained on the device. It is
 * never used for identity — identity comes solely from the verified ID token —
 * and `resourceName` is compared against that token's `sub` so a mismatched or
 * swapped access token yields nothing rather than another account's data.
 */
@Injectable()
export class GooglePeopleService {
  private readonly logger = new Logger(GooglePeopleService.name);

  async fetchBirthday(args: {
    accessToken: string;
    expectedProviderUserId: string;
  }): Promise<Date | null> {
    try {
      const res = await fetch(PEOPLE_BIRTHDAYS_URL, {
        headers: { Authorization: `Bearer ${args.accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        // 403 is routine: the user declined the birthday scope.
        this.logger.debug({ msg: 'google_people_birthday_unavailable', status: res.status });
        return null;
      }
      const body = (await res.json()) as PeopleResponse;

      // Binds the access token to the already-verified ID token subject.
      if (body.resourceName !== `people/${args.expectedProviderUserId}`) {
        this.logger.warn({ msg: 'google_people_subject_mismatch' });
        return null;
      }

      return this.toBirthday(body.birthdays);
    } catch (err) {
      this.logger.warn({ msg: 'google_people_birthday_failed', error: String(err) });
      return null;
    }
  }

  /**
   * Picks the primary birthday, falling back to the first entry that carries a
   * full date. A year-less entry (`{ month, day }`) is unusable — age is
   * derived from the birthday (Principle XXXVII / A31), so a guessed year would
   * be a fabricated age.
   */
  private toBirthday(birthdays: PeopleBirthday[] | undefined): Date | null {
    if (!birthdays?.length) return null;
    const complete = birthdays
      .map((b) => ({ primary: b.metadata?.primary === true, date: this.completeDate(b.date) }))
      .filter((b): b is { primary: boolean; date: CompleteDate } => b.date !== null);
    const chosen = complete.find((b) => b.primary) ?? complete[0];
    if (!chosen) return null;
    const { year, month, day } = chosen.date;

    // `customer_account.birthday` is `@db.Date` — build it at UTC midnight so
    // the stored calendar day cannot shift with the server's timezone.
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) return null;
    // Round-trip guard against overflow (e.g. Feb 31 → Mar 3).
    if (parsed.getUTCFullYear() !== year || parsed.getUTCDate() !== day) return null;
    return parsed;
  }

  /** Narrows to a fully-specified, in-range date; `null` for anything else. */
  private completeDate(date: PeopleDate | undefined): CompleteDate | null {
    if (!date) return null;
    const { year, month, day } = date;
    if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number') {
      return null;
    }
    const inRange =
      year >= MIN_BIRTH_YEAR &&
      year <= new Date().getUTCFullYear() &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31;
    return inRange ? { year, month, day } : null;
  }
}
