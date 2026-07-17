import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { nanoid } from 'nanoid';
import Redis from 'ioredis';

import { Url } from './url.entity';
import { CreateUrlDto } from './dto/create-url.dto';
import { trackUrlCreated, trackRedirect } from '../shared/telemetry/metrics';

@Injectable()
export class UrlService {
  private readonly logger = new Logger(UrlService.name);
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CODE_LENGTH = 7;

  constructor(
    @InjectRepository(Url)
    private readonly urlRepo: Repository<Url>,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  async create(dto: CreateUrlDto, baseUrl: string): Promise<Url> {
    this.logger.log(`Creating URL: ${dto.originalUrl.substring(0, 80)}...`);

    const shortCode = dto.customCode
      ? await this.resolveCustomCode(dto.customCode)
      : await this.generateUniqueCode();

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const url = this.urlRepo.create({
      shortCode,
      originalUrl: dto.originalUrl,
      expiresAt,
    });

    const saved = await this.urlRepo.save(url);
    this.logger.log(`Created /${shortCode} → id=${saved.id}`);

    // Warm the cache so the first redirect is fast too.
    await this.redis.set(
      this.cacheKey(shortCode),
      dto.originalUrl,
      'EX',
      this.CACHE_TTL,
    );

    trackUrlCreated();
    return saved;
  }

  async findByCode(shortCode: string): Promise<Url> {
    const url = await this.urlRepo.findOne({ where: { shortCode } });
    if (!url) {
      this.logger.warn(`URL not found: /${shortCode}`);
      throw new NotFoundException(`URL not found for code: ${shortCode}`);
    }
    return url;
  }

  async resolveOriginalUrl(shortCode: string): Promise<string> {
    // Check cache first for fast redirects.
    const cached = await this.redis.get(this.cacheKey(shortCode));
    if (cached) {
      this.logger.debug(`Cache HIT for /${shortCode}`);
      trackRedirect(shortCode);
      return cached;
    }

    this.logger.debug(`Cache MISS for /${shortCode}, querying DB...`);
    const url = await this.findByCode(shortCode);

    if (url.expiresAt && url.expiresAt < new Date()) {
      this.logger.warn(`URL expired: /${shortCode}`);
      throw new NotFoundException(`URL expired for code: ${shortCode}`);
    }

    // Cache for subsequent requests.
    await this.redis.set(
      this.cacheKey(shortCode),
      url.originalUrl,
      'EX',
      this.CACHE_TTL,
    );

    trackRedirect(shortCode);
    return url.originalUrl;
  }

  async incrementClicks(shortCode: string): Promise<void> {
    await this.urlRepo.increment({ shortCode }, 'clicks', 1);
    this.logger.debug(`Incremented clicks for /${shortCode}`);
  }

  async findAll(page: number = 1, limit: number = 20): Promise<{ items: Url[]; total: number }> {
    const [items, total] = await this.urlRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async delete(shortCode: string): Promise<void> {
    const url = await this.findByCode(shortCode);
    await this.urlRepo.remove(url);
    await this.redis.del(this.cacheKey(shortCode));
    this.logger.log(`Deleted /${shortCode} (id=${url.id})`);
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = nanoid(this.CODE_LENGTH);
      const exists = await this.urlRepo.exists({ where: { shortCode: code } });
      if (!exists) {
        this.logger.debug(`Generated code: ${code} (attempt ${attempt + 1})`);
        return code;
      }
    }
    this.logger.error('Failed to generate unique short code after 10 attempts');
    throw new Error('Failed to generate unique short code after 10 attempts');
  }

  private async resolveCustomCode(customCode: string): Promise<string> {
    const exists = await this.urlRepo.exists({ where: { shortCode: customCode } });
    if (exists) {
      this.logger.warn(`Custom code conflict: "${customCode}" already taken`);
      throw new ConflictException(`Custom code "${customCode}" is already taken`);
    }
    this.logger.log(`Using custom code: ${customCode}`);
    return customCode;
  }

  private cacheKey(shortCode: string): string {
    return `url:${shortCode}`;
  }
}
