import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  PasswordBreachedException,
  PasswordOnCommonListException,
  PasswordTooLongException,
  PasswordTooShortException,
} from '@/common/errors/domain.exceptions';
import { HibpClient } from '@/infra/hibp/hibp.client';
import { CommonPasswordsService } from '@/infra/passwords/common-passwords';

const MIN_LEN = 12;
const MAX_LEN = 128;

@Injectable()
export class PasswordService {
  constructor(
    private readonly config: ConfigService,
    private readonly hibp: HibpClient,
    private readonly commonList: CommonPasswordsService,
  ) {}

  /**
   * NIST-style policy enforcement (research R-008, R-009, spec FR-030a–e).
   * Order: cheap rejects first (length, common list), then HIBP outbound.
   */
  async validatePolicy(plain: string): Promise<void> {
    if (plain.length < MIN_LEN) throw new PasswordTooShortException(MIN_LEN);
    if (plain.length > MAX_LEN) throw new PasswordTooLongException(MAX_LEN);
    if (this.commonList.has(plain)) throw new PasswordOnCommonListException();
    if (await this.hibp.isBreached(plain)) throw new PasswordBreachedException();
  }

  async hash(plain: string): Promise<string> {
    const cost = this.config.getOrThrow<number>('BCRYPT_COST');
    return bcrypt.hash(plain, cost);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
