import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { MailService } from '../../integrations/mail/mail.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface Auth0UserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokenService: TokenService,
    private otpService: OtpService,
    private mailService: MailService,
    private httpService: HttpService,
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

    // Generate and send OTP for email verification
    const otp = await this.otpService.generateOtp(user.email);
    console.log('🚀 ~ AuthService ~ register ~ otp:', otp)
    await this.mailService.sendMail({
      to: user.email,
      subject: 'Verify Your Email - Accommodation Finder',
      template: 'verify-otp',
      context: { name: user.name, otp, year: new Date().getFullYear() },
    });

    // No tokens returned here — user must verify email first
    return {
      user,
      message: 'Please check your email for the verification code',
    };
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

  async verifyEmail(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const isValid = await this.otpService.verifyOtp(email, otp);

    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });

    // Tokens issued here — only after successful email verification
    const { emailVerified: _, ...safeUser } = user;
    return {
      user: safeUser,
      ...(await this.generateTokens(user.id)),
      message: 'Email verified successfully',
    };
  }

  async resendOtp(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    try {
      const otp = await this.otpService.generateOtp(user.email);
      await this.mailService.sendMail({
        to: user.email,
        subject: 'Verify Your Email - Accommodation Finder',
        template: 'verify-otp',
        context: { name: user.name, otp, year: new Date().getFullYear() },
      });

      return { message: 'Verification code sent successfully' };
    } catch (error) {
      if (error instanceof Error && error.message.includes('rate limit')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async generateTokens(userId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ sub: userId }),
      this.tokenService.createRefreshToken(userId),
    ]);
    return { accessToken, refreshToken };
  }

  async googleLogin(auth0Token: string) {
    // Validate the Auth0 token and get user info
    let auth0User: Auth0UserInfo;
    try {
      const response = await firstValueFrom(
        this.httpService.get<Auth0UserInfo>('https://dev-zhz6oe4tad5cryzr.us.auth0.com/userinfo', {
          headers: { Authorization: `Bearer ${auth0Token}` },
        }),
      );
      auth0User = response.data;
    } catch {
      throw new UnauthorizedException('Invalid Auth0 token');
    }

    if (!auth0User.email) {
      throw new UnauthorizedException('Email not provided by Auth0');
    }

    // Try to find existing user by auth0Id or email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ auth0Id: auth0User.sub }, { email: auth0User.email }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        auth0Id: true,
        emailVerified: true,
      },
    });

    if (user) {
      // Update auth0Id if not set (user previously registered with email/password)
      if (!user.auth0Id) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            auth0Id: auth0User.sub,
            emailVerified: auth0User.email_verified ?? true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            auth0Id: true,
            emailVerified: true,
          },
        });
      }
    } else {
      // Create new user
      try {
        user = await this.prisma.user.create({
          data: {
            email: auth0User.email,
            name: auth0User.name || auth0User.email.split('@')[0],
            avatarUrl: auth0User.picture,
            auth0Id: auth0User.sub,
            emailVerified: auth0User.email_verified ?? true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            auth0Id: true,
            emailVerified: true,
          },
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
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      ...(await this.generateTokens(user.id)),
    };
  }
}
