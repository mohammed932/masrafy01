import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PasswordBreachCheckUnavailableException } from '@/common/errors/domain.exceptions';

/**
 * HIBP Pwned Passwords k-anonymity client.
 * Sends only the first 5 hex chars of SHA-1(password). Returns true if the
 * remaining hash suffix appears in the response (= breached). Fail-closed.
 *
 * Research R-008. Spec FR-030b.
 */
@Injectable()
export class HibpClient {
  private readonly logger = new Logger(HibpClient.name);

  constructor(private readonly config: ConfigService) {}

  async isBreached(password: string): Promise<boolean> {
    if (this.config.get<boolean>('HIBP_DISABLED') === true) {
      // DEV-ONLY escape hatch; never set in prod.
      return false;
    }

    const baseUrl = this.config.getOrThrow<string>('HIBP_BASE_URL');
    const timeoutMs = this.config.getOrThrow<number>('HIBP_TIMEOUT_MS');

    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${baseUrl}/range/${prefix}`, {
        method: 'GET',
        headers: { 'Add-Padding': 'true', 'User-Agent': 'masrafy-backend/1.0' },
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn({ msg: 'hibp_non_ok', status: res.status });
        throw new PasswordBreachCheckUnavailableException();
      }
      const text = await res.text();
      // Lines are "<suffix>:<count>\r\n". Padding adds zero-count entries.
      for (const line of text.split(/\r?\n/)) {
        if (!line) continue;
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) continue;
        const lineSuffix = line.slice(0, colonIdx);
        const count = Number(line.slice(colonIdx + 1));
        if (lineSuffix === suffix && Number.isFinite(count) && count > 0) {
          return true;
        }
      }
      return false;
    } catch (err) {
      if (err instanceof PasswordBreachCheckUnavailableException) throw err;
      this.logger.warn({ msg: 'hibp_unavailable', err: this.errString(err) });
      throw new PasswordBreachCheckUnavailableException();
    } finally {
      clearTimeout(timer);
    }
  }

  private errString(err: unknown): string {
    if (err instanceof Error) return `${err.name}: ${err.message}`;
    return String(err);
  }
}
