import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_ASSET_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'assets',
  'top-10000-passwords.txt',
);

@Injectable()
export class CommonPasswordsService implements OnModuleInit {
  private readonly logger = new Logger(CommonPasswordsService.name);
  private set: Set<string> = new Set();

  async onModuleInit(): Promise<void> {
    await this.load(DEFAULT_ASSET_PATH);
  }

  async load(path: string): Promise<void> {
    try {
      const text = await readFile(path, 'utf8');
      const next = new Set<string>();
      for (const raw of text.split(/\r?\n/)) {
        const v = raw.trim().toLowerCase();
        if (v.length > 0 && !v.startsWith('#')) next.add(v);
      }
      this.set = next;
      this.logger.log({ msg: 'common_passwords_loaded', count: this.set.size });
    } catch (err) {
      this.logger.error({
        msg: 'common_passwords_load_failed',
        path,
        err: err instanceof Error ? err.message : String(err),
      });
      // Fail safe: if the file is missing, treat the deny-list as empty rather than crashing.
      // The HIBP check + length check still apply. Deployment should ensure the asset is present.
      this.set = new Set();
    }
  }

  has(password: string): boolean {
    return this.set.has(password.trim().toLowerCase());
  }

  get size(): number {
    return this.set.size;
  }
}
