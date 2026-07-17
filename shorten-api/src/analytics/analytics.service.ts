import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Click } from './click.entity';
import {
  trackRedirectByCountry,
  trackRedirectByIp,
} from '../shared/telemetry/metrics';

interface ClickMetadata {
  ipAddress: string;
  userAgent: string | null;
  referer: string | null;
}

interface GeoResult {
  country: string | null;
  city: string | null;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Click)
    private readonly clickRepo: Repository<Click>,
  ) {}

  async recordClick(
    shortCode: string,
    metadata: ClickMetadata,
  ): Promise<void> {
    const geo = await this.lookupGeo(metadata.ipAddress);

    const click = this.clickRepo.create({
      urlId: 0, // will be set after URL lookup if needed; we batch or set via urlRepo
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      referer: metadata.referer,
      country: geo.country,
      city: geo.city,
    });

    // We need the url_id — look it up by short_code.
    // We do this via a raw query to avoid importing UrlService (circular dep).
    const urlRow = await this.clickRepo.manager.query(
      `SELECT id FROM urls WHERE short_code = $1 LIMIT 1`,
      [shortCode],
    );

    if (urlRow.length === 0) return; // URL not found, skip recording

    click.urlId = urlRow[0].id;
    await this.clickRepo.save(click);

    // Prometheus metrics
    trackRedirectByCountry(shortCode, geo.country || 'unknown');
    trackRedirectByIp(metadata.ipAddress);
  }

  // ── Aggregation queries ──────────────────────────────────────────────

  async clicksTimeSeries(
    urlId: number,
    days: number = 7,
  ): Promise<{ date: string; count: number }[]> {
    const rows = await this.clickRepo.manager.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM clicks
       WHERE url_id = $1 AND created_at >= NOW() - ($2 || ' days')::INTERVAL
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [urlId, days],
    );
    return rows;
  }

  async topCountries(
    urlId: number,
    limit: number = 10,
  ): Promise<{ country: string; count: number }[]> {
    return this.clickRepo.manager.query(
      `SELECT country, COUNT(*) AS count
       FROM clicks
       WHERE url_id = $1 AND country IS NOT NULL
       GROUP BY country
       ORDER BY count DESC
       LIMIT $2`,
      [urlId, limit],
    );
  }

  async topReferrers(
    urlId: number,
    limit: number = 10,
  ): Promise<{ referer: string; count: number }[]> {
    return this.clickRepo.manager.query(
      `SELECT referer, COUNT(*) AS count
       FROM clicks
       WHERE url_id = $1 AND referer IS NOT NULL AND referer != ''
       GROUP BY referer
       ORDER BY count DESC
       LIMIT $2`,
      [urlId, limit],
    );
  }

  async topIps(
    urlId: number,
    limit: number = 10,
  ): Promise<{ ipPrefix: string; count: number }[]> {
    const rows = await this.clickRepo.manager.query(
      `SELECT ip_address, COUNT(*) AS count
       FROM clicks
       WHERE url_id = $1 AND ip_address IS NOT NULL
       GROUP BY ip_address
       ORDER BY count DESC
       LIMIT $2`,
      [urlId, limit],
    );
    // Anonymise to /24 prefix.
    return rows.map((r: any) => ({
      ipPrefix: this.toPrefix24(r.ip_address),
      count: Number(r.count),
    }));
  }

  /** Approximate count of unique IPs from the clicks table. */
  async uniqueIpCount(urlId: number): Promise<number> {
    const rows = await this.clickRepo.manager.query(
      `SELECT COUNT(DISTINCT ip_address) AS count
       FROM clicks
       WHERE url_id = $1 AND ip_address IS NOT NULL`,
      [urlId],
    );
    return rows[0] ? parseInt(rows[0].count, 10) : 0;
  }

  // ── IP Geolocation ───────────────────────────────────────────────────

  private async lookupGeo(ip: string): Promise<GeoResult> {
    // Skip private/localhost IPs.
    if (!ip || ip === 'unknown' || this.isPrivateIp(ip)) {
      return { country: null, city: null };
    }

    try {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,city`);
      if (!res.ok) return { country: null, city: null };
      const data = await res.json();
      return {
        country: data.countryCode || null,
        city: data.city || null,
      };
    } catch {
      return { country: null, city: null };
    }
  }

  private isPrivateIp(ip: string): boolean {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('172.')) {
      return true;
    }
    if (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('169.254.')
    ) {
      return true;
    }
    return false;
  }

  private toPrefix24(ip: string): string {
    if (!ip || ip === 'unknown') return 'unknown';
    const parts = ip.includes('.') ? ip.split('.') : ip.split(':');
    return parts
      .slice(0, ip.includes('.') ? 3 : 4)
      .join(ip.includes('.') ? '.' : ':');
  }
}
