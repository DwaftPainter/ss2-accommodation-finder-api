import { Injectable, Inject } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { UPSTASH_REDIS } from 'src/redis/redis.module';

const OTP_TTL_SEC = 60 * 10; // 10 minutes
const OTP_RATE_LIMIT_SEC = 60; // 1 minute between resends

@Injectable()
export class OtpService {
  constructor(@Inject(UPSTASH_REDIS) private redis: Redis) {}

  async generateOtp(email: string): Promise<string> {
    // Check rate limiting
    const rateLimitKey = `otp:ratelimit:${email}`;
    const rateLimited = await this.redis.get(rateLimitKey);
    if (rateLimited) {
      throw new Error('Please wait before requesting another OTP');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpKey = `otp:${email}`;

    await Promise.all([
      // Store OTP with TTL
      this.redis.set(otpKey, otp, { ex: OTP_TTL_SEC }),
      // Set rate limit
      this.redis.set(rateLimitKey, '1', { ex: OTP_RATE_LIMIT_SEC }),
    ]);

    return otp;
  }

  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const otpKey = `otp:${email}`;
    const storedOtp = await this.redis.get<string>(otpKey);

    if (!storedOtp) {
      return false;
    }

    if (storedOtp !== otp) {
      return false;
    }

    // Delete OTP after successful verification
    await this.redis.del(otpKey);

    return true;
  }

  async deleteOtp(email: string): Promise<void> {
    await this.redis.del(`otp:${email}`);
  }
}
