import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    RedisModule,
    JwtModule.register({
      secret: 'SECRET_KEY',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService, TokenService],
})
export class AuthModule {}
