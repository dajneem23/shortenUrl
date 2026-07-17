import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-native Count-Min Sketch for bounded-memory frequency estimation.
 *
 * Uses Redis Stack's `CMS.INCRBY` / `CMS.QUERY` — a C-level implementation
 * with guaranteed error bounds.
 *
 * Default: width=2000, depth=10 → ε≈0.001, δ≈0.000045 → ~80 KB per sketch
 */
@Injectable()
export class CountMinSketchService {
  private readonly logger = new Logger(CountMinSketchService.name);
  private readonly WIDTH = 2000;
  private readonly DEPTH = 10;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async increment(sketchName: string, item: string, count: number = 1): Promise<void> {
    const key = this.sketchKey(sketchName);
    await this.ensureSketch(key);

    await this.redis.call('CMS.INCRBY', key, item, String(count));
    this.logger.debug(`CMS[${sketchName}]: incremented "${item}" by ${count}`);

    await this.redis.expire(key, 60 * 60 * 24 * 14);
  }

  async estimate(sketchName: string, item: string): Promise<number> {
    const key = this.sketchKey(sketchName);
    try {
      const result = await this.redis.call('CMS.QUERY', key, item);
      if (Array.isArray(result)) {
        return Math.min(...result.map(Number));
      }
      return 0;
    } catch {
      return 0;
    }
  }

  async incrementAndEstimate(
    sketchName: string,
    item: string,
  ): Promise<number> {
    await this.increment(sketchName, item);
    return this.estimate(sketchName, item);
  }

  async reset(sketchName: string): Promise<void> {
    await this.redis.del(this.sketchKey(sketchName));
    this.logger.log(`CMS sketch reset: ${sketchName}`);
  }

  async estimateIpClicks(ip: string, windowSeconds: number = 3600): Promise<number> {
    const sketchName = `ip:${this.windowLabel(windowSeconds)}`;
    return this.estimate(sketchName, ip);
  }

  async recordIpClick(ip: string, windowSeconds: number = 3600): Promise<void> {
    const sketchName = `ip:${this.windowLabel(windowSeconds)}`;
    await this.increment(sketchName, ip);
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async ensureSketch(key: string): Promise<void> {
    try {
      await this.redis.call('CMS.INFO', key);
    } catch {
      this.logger.log(`Creating CMS sketch: ${key}`);
      await this.redis.call(
        'CMS.INITBYDIM',
        key,
        String(this.WIDTH),
        String(this.DEPTH),
      );
    }
  }

  private sketchKey(name: string): string {
    return `cms:${name}`;
  }

  private windowLabel(seconds: number): string {
    if (seconds <= 60) return '1m';
    if (seconds <= 3600) return '1h';
    if (seconds <= 86400) return '24h';
    return '7d';
  }
}
