import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateUrlDto {
  @Expose({ name: 'original_url' })
  @Matches(/^https?:\/\/\S+$/i, { message: 'original_url must be a valid HTTP or HTTPS URL' })
  originalUrl: string;

  @Expose({ name: 'custom_code' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(8)
  customCode?: string;

  @Expose({ name: 'expires_at' })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}
