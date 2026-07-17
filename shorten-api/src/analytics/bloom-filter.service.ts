import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-native Bloom Filter for IP dedup per short URL.
 *
 * Uses Redis Stack's `BF.ADD` / `BF.EXISTS` — a C-level implementation that
 * runs in O(k) time with negligible memory overhead.
 *
 * Each short_code gets its own filter key: `bf:ip:{shortCode}`.
 * Default: error_rate=0.001, capacity=100 000 → ~175 KB per filter.
 */
@Injectable()
export class BloomFilterService {
  private readonly logger = new Logger(BloomFilterService.name);
  private readonly ERROR_RATE = 0.001;
  private readonly CAPACITY = 100_000;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Returns `true` if the IP is definitely NEW (not seen before for this URL).
   */
  async isNewIp(shortCode: string, ip: string): Promise<boolean> {
    const key = this.filterKey(shortCode);
    await this.ensureFilter(key);

    const result = await this.redis.call('BF.ADD', key, ip);

    if (result === 1) {
      this.logger.debug(`Bloom: NEW IP for /${shortCode} (${this.ipPrefix(ip)})`);
      return true;
    }
    this.logger.debug(`Bloom: REPEAT IP for /${shortCode} (${this.ipPrefix(ip)})`);
    return false;
  }

  async reset(shortCode: string): Promise<void> {
    await this.redis.del(this.filterKey(shortCode));
    this.logger.log(`Bloom filter reset for /${shortCode}`);
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async ensureFilter(key: string): Promise<void> {
    try {
      await this.redis.call('BF.INFO', key);
    } catch {
      this.logger.log(`Creating Bloom filter: ${key}`);
      await this.redis.call(
        'BF.RESERVE',
        key,
        String(this.ERROR_RATE),
        String(this.CAPACITY),
      );
      await this.redis.expire(key, 60 * 60 * 24 * 30);
    }
  }

  private filterKey(shortCode: string): string {
    return `bf:ip:${shortCode}`;
  }

  private ipPrefix(ip: string): string {
    if (!ip || ip === 'unknown') return '??';
    return ip.includes('.') ? ip.split('.').slice(0, 3).join('.') : ip.substring(0, 7);
  }
}
