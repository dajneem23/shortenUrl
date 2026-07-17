import { IsUrl, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUrlDto {
  @IsUrl({ protocols: ['http', 'https'] }, { message: 'original_url must be a valid HTTP or HTTPS URL' })
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
