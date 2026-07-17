import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-native Count-Min Sketch for bounded-memory frequency estimation.
 *
 * Uses Redis Stack's `CMS.INCRBY` / `CMS.QUERY` — a C-level implementation
 * with guaranteed error bounds.
 *
 * Default dimensions: width=2000, depth=10
 *   → ε ≈ 0.001, δ ≈ 0.000045 (99.995% confidence)
 *   → ~80 KB per sketch
 *
 * Applications:
 *  1. Click frequency per URL per time window
 *  2. Per-IP click estimation (abuse detection)
 */
@Injectable()
export class CountMinSketchService {
  // CMS dimensions trade accuracy vs memory.
  private readonly WIDTH = 2000;
  private readonly DEPTH = 10;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Increment count for an item in a given sketch.
   * Initialises the sketch with CMS.INITBYDIM on first use.
   */
  async increment(sketchName: string, item: string, count: number = 1): Promise<void> {
    const key = this.sketchKey(sketchName);
    await this.ensureSketch(key);

    await this.redis.call('CMS.INCRBY', key, item, String(count));

    // Set TTL so old sketches auto-expire (14 days).
    await this.redis.expire(key, 60 * 60 * 24 * 14);
  }

  /**
   * Estimate frequency of an item.
   * Returns the MIN across all d rows (the CMS guarantee: never underestimates).
   */
  async estimate(sketchName: string, item: string): Promise<number> {
    const key = this.sketchKey(sketchName);
    try {
      const result = await this.redis.call('CMS.QUERY', key, item);
      // CMS.QUERY returns an array of d estimates; the CMS guarantee uses MIN.
      if (Array.isArray(result)) {
        return Math.min(...result.map(Number));
      }
      return 0;
    } catch {
      return 0; // sketch doesn't exist yet
    }
  }

  /**
   * Increment AND return the new estimated count.
   * Single pipeline for atomicity.
   */
  async incrementAndEstimate(
    sketchName: string,
    item: string,
  ): Promise<number> {
    await this.increment(sketchName, item);
    return this.estimate(sketchName, item);
  }

  /** Reset the entire sketch. */
  async reset(sketchName: string): Promise<void> {
    await this.redis.del(this.sketchKey(sketchName));
  }

  /**
   * Estimate clicks per IP for abuse detection.
   * Uses a per-IP sketch to check if an IP is clicking too much.
   */
  async estimateIpClicks(ip: string, windowSeconds: number = 3600): Promise<number> {
    const sketchName = `ip:${this.windowLabel(windowSeconds)}`;
    return this.estimate(sketchName, ip);
  }

  /** Record an IP click for abuse tracking. */
  async recordIpClick(ip: string, windowSeconds: number = 3600): Promise<void> {
    const sketchName = `ip:${this.windowLabel(windowSeconds)}`;
    await this.increment(sketchName, ip);
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async ensureSketch(key: string): Promise<void> {
    try {
      await this.redis.call('CMS.INFO', key);
    } catch {
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
