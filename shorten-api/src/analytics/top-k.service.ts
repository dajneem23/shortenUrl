import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-native Top-K for trending URL detection across sliding windows.
 *
 * Uses Redis Stack's `TOPK.ADD` / `TOPK.LIST` with the HeavyKeeper algorithm.
 * This is a probabilistic Top-K data structure that tracks the most frequent
 * items with bounded memory — no sorting, no leaderboard maintenance needed.
 *
 * Windows: 1h, 24h, 7d — each gets its own Top-K sketch.
 * Default: k=50, width=8, depth=7, decay=0.9
 *   → ~4 KB per sketch
 */
@Injectable()
export class TopKService {
  private readonly WINDOWS = ['1h', '24h', '7d'];
  private readonly TOPK_K = 50;
  private readonly TOPK_WIDTH = 8;
  private readonly TOPK_DEPTH = 7;
  private readonly TOPK_DECAY = 0.9;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /** Record a click — adds the short code to all window Top-K sketches. */
  async recordClick(shortCode: string): Promise<void> {
    const pipe = this.redis.pipeline();

    for (const window of this.WINDOWS) {
      const key = this.sketchKey(window);
      pipe.call('TOPK.ADD', key, shortCode);
      // TTL: 2× window
      pipe.expire(key, this.windowSeconds(window) * 2);
    }

    await pipe.exec();
  }

  /** Get top-K short codes in a given window. */
  async topK(window: string = '1h', k: number = 15): Promise<{ shortCode: string; clicks: number }[]> {
    if (!this.WINDOWS.includes(window)) {
      throw new Error(`Unknown window: ${window}. Use ${this.WINDOWS.join(', ')}`);
    }

    const key = this.sketchKey(window);
    await this.ensureSketch(key);

    try {
      // TOPK.LIST WITHCOUNT returns [item1, count1, item2, count2, ...]
      const result: string[] = await this.redis.call(
        'TOPK.LIST',
        key,
        'WITHCOUNT',
      ) as any;

      const items: { shortCode: string; clicks: number }[] = [];
      for (let i = 0; i < result.length && items.length < k; i += 2) {
        items.push({
          shortCode: result[i],
          clicks: parseInt(result[i + 1], 10),
        });
      }
      return items;
    } catch {
      return [];
    }
  }

  /**
   * Query whether a short code is in the Top-K for a window.
   * Uses TOPK.QUERY which returns 1 (in top-k) or 0 (not).
   */
  async isTrending(window: string, shortCode: string): Promise<boolean> {
    if (!this.WINDOWS.includes(window)) return false;

    const key = this.sketchKey(window);
    try {
      const result: any = await this.redis.call('TOPK.QUERY', key, shortCode);
      // Returns array of 1/0 for each queried item.
      return Array.isArray(result) && result[0] === 1;
    } catch {
      return false;
    }
  }

  /**
   * Get the estimated count of a short code within a window.
   * Uses TOPK.COUNT which returns the estimated frequency.
   */
  async estimateCount(window: string, shortCode: string): Promise<number> {
    if (!this.WINDOWS.includes(window)) return 0;

    const key = this.sketchKey(window);
    try {
      const result: any = await this.redis.call('TOPK.COUNT', key, shortCode);
      return Array.isArray(result) ? Number(result[0]) : 0;
    } catch {
      return 0;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async ensureSketch(key: string): Promise<void> {
    try {
      await this.redis.call('TOPK.INFO', key);
    } catch {
      await this.redis.call(
        'TOPK.RESERVE',
        key,
        String(this.TOPK_K),
        String(this.TOPK_WIDTH),
        String(this.TOPK_DEPTH),
        String(this.TOPK_DECAY),
      );
    }
  }

  private sketchKey(window: string): string {
    return `topk:${window}`;
  }

  private windowSeconds(window: string): number {
    switch (window) {
      case '1h': return 3600;
      case '24h': return 86400;
      case '7d': return 604800;
      default: return 3600;
    }
  }
}
