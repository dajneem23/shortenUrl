import { IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateUrlDto {
  @Matches(/^https?:\/\/\S+$/i, { message: 'original_url must be a valid HTTP or HTTPS URL' })
  originalUrl: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(8)
  customCode?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string; // ISO 8601 date string, nullable
}
