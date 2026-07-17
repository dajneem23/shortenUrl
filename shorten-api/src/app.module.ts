import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from './shared/redis/redis.module';
import { UrlModule } from './url/url.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MetricsModule } from './shared/telemetry/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'urlshortener',
      database: process.env.DB_DATABASE || 'shortenurl',
      autoLoadEntities: true,
      synchronize: false, // schema managed by postgres/init/01-init.sql
    }),
    RedisModule,
    MetricsModule,
    UrlModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
