import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokenService: TokenService,
  ) {}

  async register(data: RegisterDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    let user: { id: string; email: string; name: string };
    try {
      user = await this.prisma.user.create({
        data: { email: data.email, password: hashedPassword, name: data.name },
        select: { id: true, email: true, name: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw e;
    }

    return { user, ...(await this.generateTokens(user.id)) };
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, email: true, name: true, password: true },
    });

    const hash = user?.password ?? '$2b$10$invalidhashpadding000000000000';
    const isMatch = await bcrypt.compare(data.password, hash);

    if (!user || !isMatch)
      throw new UnauthorizedException('Invalid credentials');

    const { password: _, ...safeUser } = user;
    return { user: safeUser, ...(await this.generateTokens(user.id)) };
  }

  async refresh(oldToken: string) {
    const userId = await this.tokenService.resolveRefreshToken(oldToken);
    if (!userId)
      throw new UnauthorizedException('Refresh token invalid or expired');

    const refreshToken = await this.tokenService.rotateRefreshToken(
      oldToken,
      userId,
    );
    const accessToken = await this.jwtService.signAsync({ sub: userId });

    return { accessToken, refreshToken };
  }

  async logout(token: string, userId: string) {
    await this.tokenService.deleteRefreshToken(token, userId);
  }

  async logoutAll(userId: string) {
    await this.tokenService.deleteAllUserTokens(userId);
  }

  private async generateTokens(userId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ sub: userId }),
      this.tokenService.createRefreshToken(userId),
    ]);
    return { accessToken, refreshToken };
  }
}
