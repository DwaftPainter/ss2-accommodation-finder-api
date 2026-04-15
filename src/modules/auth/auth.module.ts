import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { RedisModule } from '../../redis/redis.module';
import { MailModule } from '../../integrations/mail/mail.module';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    RedisModule,
    MailModule,
    HttpModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PrismaService,
    TokenService,
    OtpService,
  ],
})
export class AuthModule {}
