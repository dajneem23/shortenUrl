import { Injectable, Inject } from '@nestjs/common';
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
  private readonly ERROR_RATE = 0.001;
  private readonly CAPACITY = 100_000;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Returns `true` if the IP is definitely NEW (not seen before for this URL).
   * Uses `BF.ADD` which atomically checks AND adds — returns 1 if new, 0 if
   * possibly already present.
   */
  async isNewIp(shortCode: string, ip: string): Promise<boolean> {
    const key = this.filterKey(shortCode);
    await this.ensureFilter(key);

    // BF.ADD returns 1 if the item was newly added (was NOT present).
    // It returns 0 if the item MAY already exist.
    const result = await this.redis.call('BF.ADD', key, ip);
    return result === 1;
  }

  /** Reset the Bloom filter for a given short code. */
  async reset(shortCode: string): Promise<void> {
    await this.redis.del(this.filterKey(shortCode));
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /** Ensure the Bloom filter key exists (create if missing). */
  private async ensureFilter(key: string): Promise<void> {
    // Check if key already exists by inspecting its type.
    try {
      await this.redis.call('BF.INFO', key);
    } catch {
      // Key doesn't exist — create it with BF.RESERVE.
      await this.redis.call(
        'BF.RESERVE',
        key,
        String(this.ERROR_RATE),
        String(this.CAPACITY),
      );
      // Set a TTL so old filters auto-expire (30 days).
      await this.redis.expire(key, 60 * 60 * 24 * 30);
    }
  }

  private filterKey(shortCode: string): string {
    return `bf:ip:${shortCode}`;
  }
}
