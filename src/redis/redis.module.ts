import { Module, Global } from '@nestjs/common';
import { Redis } from '@upstash/redis';

export const UPSTASH_REDIS = 'UPSTASH_REDIS';

@Global()
@Module({
  providers: [
    {
      provide: UPSTASH_REDIS,
      useFactory: () =>
        new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        }),
    },
  ],
  exports: [UPSTASH_REDIS],
})
export class RedisModule {}
