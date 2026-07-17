import { Expose } from 'class-transformer';

export class UrlResponseDto {
  @Expose()
  id: number;

  @Expose()
  shortCode: string;

  @Expose()
  originalUrl: string;

  @Expose()
  shortUrl: string;

  @Expose()
  clicks: number;

  @Expose()
  createdAt: Date;

  @Expose()
  expiresAt: Date | null;

  @Expose()
  topCountries: { country: string; count: number }[];

  @Expose()
  topReferrers: { referer: string; count: number }[];
}
