import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const host = process.env.REDIS_HOST || 'redis';
        const port = parseInt(process.env.REDIS_PORT || '6379', 10);
        return new Redis({
          host,
          port,
          maxRetriesPerRequest: null,
          retryStrategy(times) {
            return Math.min(times * 200, 3000);
          },
        });
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
