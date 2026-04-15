import { Injectable, Inject } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import * as crypto from 'crypto';
import { UPSTASH_REDIS } from '../../redis/redis.module';

const REFRESH_TTL_SEC = 60 * 60 * 24 * 30; // 30 ngày

@Injectable()
export class TokenService {
  constructor(@Inject(UPSTASH_REDIS) private redis: Redis) {}

  async createRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');

    await Promise.all([
      // token → userId, tự hết hạn sau 30 ngày
      this.redis.set(`refresh:${token}`, userId, { ex: REFRESH_TTL_SEC }),
      // thêm token vào set của user, dùng cho logout-all
      this.redis.sadd(`refresh:user:${userId}`, token),
      this.redis.expire(`refresh:user:${userId}`, REFRESH_TTL_SEC),
    ]);

    return token;
  }

  async resolveRefreshToken(token: string): Promise<string | null> {
    return this.redis.get<string>(`refresh:${token}`);
  }

  async rotateRefreshToken(oldToken: string, userId: string): Promise<string> {
    await this.deleteRefreshToken(oldToken, userId);
    return this.createRefreshToken(userId);
  }

  async deleteRefreshToken(token: string, userId: string): Promise<void> {
    await Promise.all([
      this.redis.del(`refresh:${token}`),
      this.redis.srem(`refresh:user:${userId}`, token),
    ]);
  }

  async deleteAllUserTokens(userId: string): Promise<void> {
    const tokens = await this.redis.smembers(`refresh:user:${userId}`);

    if (tokens.length === 0) return;

    await Promise.all([
      ...tokens.map((t) => this.redis.del(`refresh:${t}`)),
      this.redis.del(`refresh:user:${userId}`),
    ]);
  }
}
