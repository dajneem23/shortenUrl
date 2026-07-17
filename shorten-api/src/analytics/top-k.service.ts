import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-native Top-K for trending URL detection across sliding windows.
 *
 * Uses Redis Stack's `TOPK.ADD` / `TOPK.LIST` with the HeavyKeeper algorithm.
 *
 * Windows: 1h, 24h, 7d — each gets its own Top-K sketch.
 * Default: k=50, width=8, depth=7, decay=0.9 → ~4 KB per sketch
 */
@Injectable()
export class TopKService {
  private readonly logger = new Logger(TopKService.name);
  private readonly WINDOWS = ['1h', '24h', '7d'];
  private readonly TOPK_K = 50;
  private readonly TOPK_WIDTH = 8;
  private readonly TOPK_DEPTH = 7;
  private readonly TOPK_DECAY = 0.9;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async recordClick(shortCode: string): Promise<void> {
    const pipe = this.redis.pipeline();

    for (const window of this.WINDOWS) {
      const key = this.sketchKey(window);
      pipe.call('TOPK.ADD', key, shortCode);
      pipe.expire(key, this.windowSeconds(window) * 2);
    }

    await pipe.exec();
    this.logger.debug(`TopK: recorded /${shortCode} in all windows`);
  }

  async topK(window: string = '1h', k: number = 15): Promise<{ shortCode: string; clicks: number }[]> {
    if (!this.WINDOWS.includes(window)) {
      throw new Error(`Unknown window: ${window}. Use ${this.WINDOWS.join(', ')}`);
    }

    const key = this.sketchKey(window);
    await this.ensureSketch(key);

    try {
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
      this.logger.debug(`TopK[${window}]: returned ${items.length} items`);
      return items;
    } catch (err: any) {
      this.logger.warn(`TopK[${window}] query failed: ${err.message}`);
      return [];
    }
  }

  async isTrending(window: string, shortCode: string): Promise<boolean> {
    if (!this.WINDOWS.includes(window)) return false;

    const key = this.sketchKey(window);
    try {
      const result: any = await this.redis.call('TOPK.QUERY', key, shortCode);
      return Array.isArray(result) && result[0] === 1;
    } catch {
      return false;
    }
  }

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
      this.logger.log(`Creating Top-K sketch: ${key}`);
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
