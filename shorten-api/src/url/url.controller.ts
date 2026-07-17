import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  Req,
  HttpStatus,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { UrlService } from './url.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { BloomFilterService } from '../analytics/bloom-filter.service';
import { TopKService } from '../analytics/top-k.service';
import { CreateUrlDto } from './dto/create-url.dto';
import { MetricsInterceptor } from '../common/interceptors/metrics.interceptor';
import { trackUniqueVisitor } from '../shared/telemetry/metrics';

@Controller()
@UseInterceptors(MetricsInterceptor)
export class UrlController {
  private readonly logger = new Logger(UrlController.name);

  constructor(
    private readonly urlService: UrlService,
    private readonly analyticsService: AnalyticsService,
    private readonly bloomFilter: BloomFilterService,
    private readonly topK: TopKService,
  ) {}

  // ── Go link (/go/:code) — records click, redirects to original URL ────

  @Get('go/:code')
  async goRedirect(
    @Param('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Resolve from Redis cache (fast) or Postgres fallback.
    const originalUrl = await this.urlService.resolveOriginalUrl(code);

    this.logger.log(`Go redirect /${code} → ${originalUrl.substring(0, 60)}...`);

    // Record click — fire-and-forget, never blocks the redirect.
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const metadata = {
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || null,
      referer: req.headers['referer'] || null,
    };

    this.bloomFilter.isNewIp(code, ip).then((isNew) => {
      if (isNew) trackUniqueVisitor(code);
    }).catch(() => {});

    this.analyticsService.recordClick(code, metadata).catch(() => {});
    this.urlService.incrementClicks(code).catch(() => {});
    this.topK.recordClick(code).catch(() => {});

    return res.redirect(HttpStatus.FOUND, originalUrl);
  }

  // ── REST API ─────────────────────────────────────────────────────────

  @Post('api/urls')
  async create(@Body() dto: CreateUrlDto) {
    const baseUrl = this.baseUrlFromEnv();
    const url = await this.urlService.create(dto, baseUrl);
    return this.toResponse(url, baseUrl);
  }

  @Get('api/urls')
  async findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    const { items, total } = await this.urlService.findAll(+page, +limit);
    const baseUrl = this.baseUrlFromEnv();
    return {
      items: items.map((url) => this.toResponse(url, baseUrl)),
      total,
      page: +page,
      limit: +limit,
    };
  }

  /** Trending URLs — Top-K across sliding windows. */
  @Get('api/urls/trending')
  async trending(@Query('window') window = '1h') {
    const top = await this.topK.topK(window, 15);
    return { window, top };
  }

  @Get('api/urls/:code')
  async findOne(@Param('code') code: string) {
    const url = await this.urlService.findByCode(code);
    const baseUrl = this.baseUrlFromEnv();
    const topCountries = await this.analyticsService.topCountries(url.id);
    const topReferrers = await this.analyticsService.topReferrers(url.id);
    return {
      ...this.toResponse(url, baseUrl),
      topCountries,
      topReferrers,
    };
  }

  @Delete('api/urls/:code')
  async delete(@Param('code') code: string) {
    await this.urlService.delete(code);
    await this.bloomFilter.reset(code);
    return { message: 'Deleted' };
  }

  @Get('api/urls/:code/clicks')
  async getClicks(
    @Param('code') code: string,
    @Query('days') days = 7,
  ) {
    const url = await this.urlService.findByCode(code);
    const timeSeries = await this.analyticsService.clicksTimeSeries(url.id, +days);
    const byCountry = await this.analyticsService.topCountries(url.id);
    const byReferrer = await this.analyticsService.topReferrers(url.id);
    const byIp = await this.analyticsService.topIps(url.id);
    const uniqueIps = await this.analyticsService.uniqueIpCount(url.id);

    return {
      shortCode: url.shortCode,
      totalClicks: url.clicks,
      uniqueIps,
      timeSeries,
      byCountry,
      byReferrer,
      byIp,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private toResponse(url: any, baseUrl: string) {
    return {
      id: url.id,
      shortCode: url.shortCode,
      originalUrl: url.originalUrl,
      shortUrl: `${baseUrl}/go/${url.shortCode}`,
      clicks: url.clicks,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
    };
  }

  private baseUrlFromEnv(): string {
    return process.env.BASE_URL || 'http://localhost';
  }
}
