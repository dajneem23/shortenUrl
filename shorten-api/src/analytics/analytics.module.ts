import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Click } from './click.entity';
import { AnalyticsService } from './analytics.service';
import { BloomFilterService } from './bloom-filter.service';
import { CountMinSketchService } from './count-min-sketch.service';
import { TopKService } from './top-k.service';

@Module({
  imports: [TypeOrmModule.forFeature([Click])],
  providers: [AnalyticsService, BloomFilterService, CountMinSketchService, TopKService],
  exports: [AnalyticsService, BloomFilterService, CountMinSketchService, TopKService],
})
export class AnalyticsModule {}
