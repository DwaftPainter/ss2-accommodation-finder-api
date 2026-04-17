import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokenService: TokenService,
    private otpService: OtpService,
    private mailService: MailService,
    private httpService: HttpService,
  ) {}

  async register(data: RegisterDto) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);

      let user: { id: string; email: string; name: string };
      try {
        user = await this.prisma.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            name: data.name,
          },
          select: { id: true, email: true, name: true },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException('Email already exists');
        }
        this.logger.error('[AuthService.register] Failed to create user:', e);
        throw e;
      }

      try {
        const otp = await this.otpService.generateOtp(user.email);
        this.logger.debug(`Generated OTP for ${user.email}: ${otp}`);
        await this.mailService.sendMail({
          to: user.email,
          subject: 'Verify Your Email - Accommodation Finder',
          template: 'verify-otp',
          context: { name: user.name, otp, year: new Date().getFullYear() },
        });
      } catch (e) {
        this.logger.error(
          '[AuthService.register] Failed to send verification OTP email:',
          e,
        );
        throw new InternalServerErrorException(
          'Failed to send verification email',
        );
      }

      return {
        user,
        message: 'Please check your email for the verification code',
      };
    } catch (e) {
      if (
        e instanceof ConflictException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      this.logger.error('[AuthService.register] Unexpected error:', e);
      throw new InternalServerErrorException('Registration failed');
    }
  }

  async login(data: LoginDto) {
    console.log('🚀 ~ AuthService ~ login ~ data:', data)
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true, email: true, name: true, password: true },
      });
      console.log('🚀 ~ AuthService ~ login ~ user:', user)

      const hash = user?.password ?? '$2b$10$invalidhashpadding000000000000';
      console.log('🚀 ~ AuthService ~ login ~ hash:', hash)
      const isMatch = await bcrypt.compare(data.password, hash);
      console.log('🚀 ~ AuthService ~ login ~ isMatch:', isMatch)

      if (!user || !isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const { password: _, ...safeUser } = user;

      try {
        const tokens = await this.generateTokens(user.id);
        console.log('🚀 ~ AuthService ~ login ~ safeUser:', safeUser)
        return { user: safeUser, ...tokens };
      } catch (e) {
        this.logger.error('[AuthService.login] Failed to generate tokens:', e);
        throw new InternalServerErrorException(
          'Login failed: could not issue tokens',
        );
      }
    } catch (e) {
      if (
        e instanceof UnauthorizedException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      this.logger.error('[AuthService.login] Unexpected error:', e);
      throw new InternalServerErrorException('Login failed');
    }
  }

  async refresh(oldToken: string) {
    try {
      const userId = await this.tokenService.resolveRefreshToken(oldToken);
      if (!userId) {
        throw new UnauthorizedException('Refresh token invalid or expired');
      }

      try {
        const refreshToken = await this.tokenService.rotateRefreshToken(
          oldToken,
          userId,
        );
        const accessToken = await this.jwtService.signAsync({ sub: userId });
        return { accessToken, refreshToken };
      } catch (e) {
        this.logger.error('[AuthService.refresh] Failed to rotate tokens:', e);
        throw new InternalServerErrorException('Token refresh failed');
      }
    } catch (e) {
      if (
        e instanceof UnauthorizedException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      this.logger.error('[AuthService.refresh] Unexpected error:', e);
      throw new InternalServerErrorException('Token refresh failed');
    }
  }

  async logout(token: string, userId: string) {
    try {
      await this.tokenService.deleteRefreshToken(token, userId);
    } catch (e) {
      this.logger.error(
        '[AuthService.logout] Failed to delete refresh token:',
        e,
      );
      throw new InternalServerErrorException('Logout failed');
    }
  }

  async logoutAll(userId: string) {
    try {
      await this.tokenService.deleteAllUserTokens(userId);
    } catch (e) {
      this.logger.error(
        '[AuthService.logoutAll] Failed to delete all user tokens:',
        e,
      );
      throw new InternalServerErrorException('Logout from all devices failed');
    }
  }

  async verifyEmail(email: string, otp: string) {
    try {
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

      let isValid: boolean;
      try {
        isValid = await this.otpService.verifyOtp(email, otp);
      } catch (e) {
        this.logger.error(
          '[AuthService.verifyEmail] OTP verification service error:',
          e,
        );
        throw new InternalServerErrorException('OTP verification failed');
      }

      if (!isValid) {
        throw new BadRequestException('Invalid or expired OTP');
      }

      try {
        await this.prisma.user.update({
          where: { email },
          data: { emailVerified: true },
        });
      } catch (e) {
        this.logger.error(
          '[AuthService.verifyEmail] Failed to update emailVerified flag:',
          e,
        );
        throw new InternalServerErrorException('Failed to verify email');
      }

      const { emailVerified: _, ...safeUser } = user;

      try {
        const tokens = await this.generateTokens(user.id);
        return {
          user: safeUser,
          ...tokens,
          message: 'Email verified successfully',
        };
      } catch (e) {
        this.logger.error(
          '[AuthService.verifyEmail] Failed to generate tokens:',
          e,
        );
        throw new InternalServerErrorException(
          'Email verified but failed to issue tokens',
        );
      }
    } catch (e) {
      if (
        e instanceof NotFoundException ||
        e instanceof BadRequestException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      this.logger.error('[AuthService.verifyEmail] Unexpected error:', e);
      throw new InternalServerErrorException('Email verification failed');
    }
  }

  async resendOtp(email: string) {
    try {
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
        this.logger.error(
          '[AuthService.resendOtp] Failed to generate/send OTP:',
          error,
        );
        throw new InternalServerErrorException(
          'Failed to resend verification code',
        );
      }
    } catch (e) {
      if (
        e instanceof NotFoundException ||
        e instanceof BadRequestException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      this.logger.error('[AuthService.resendOtp] Unexpected error:', e);
      throw new InternalServerErrorException('Resend OTP failed');
    }
  }

  private async generateTokens(userId: string) {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync({ sub: userId }),
        this.tokenService.createRefreshToken(userId),
      ]);
      return { accessToken, refreshToken };
    } catch (e) {
      this.logger.error(
        '[AuthService.generateTokens] Failed to generate tokens for user:',
        userId,
        e,
      );
      throw e;
    }
  }

  async googleLogin(auth0Token: string) {
    try {
      let auth0User: Auth0UserInfo;
      try {
        const response = await firstValueFrom(
          this.httpService.get<Auth0UserInfo>(
            'https://dev-zhz6oe4tad5cryzr.us.auth0.com/userinfo',
            { headers: { Authorization: `Bearer ${auth0Token}` } },
          ),
        );
        auth0User = response.data;
      } catch (e) {
        this.logger.error(
          '[AuthService.googleLogin] Failed to fetch Auth0 user info:',
          e,
        );
        throw new UnauthorizedException('Invalid Auth0 token');
      }

      if (!auth0User.email) {
        throw new UnauthorizedException('Email not provided by Auth0');
      }

      let user: {
        id: string;
        email: string;
        name: string;
        auth0Id: string | null;
        emailVerified: boolean;
      } | null;

      try {
        user = await this.prisma.user.findFirst({
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
      } catch (e) {
        this.logger.error(
          '[AuthService.googleLogin] Failed to query user from DB:',
          e,
        );
        throw new InternalServerErrorException('Google login failed');
      }

      if (user) {
        if (!user.auth0Id) {
          try {
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
          } catch (e) {
            this.logger.error(
              '[AuthService.googleLogin] Failed to update user auth0Id:',
              e,
            );
            throw new InternalServerErrorException('Google login failed');
          }
        }
      } else {
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
          this.logger.error(
            '[AuthService.googleLogin] Failed to create new user:',
            e,
          );
          throw e;
        }
      }

      try {
        const tokens = await this.generateTokens(user.id);
        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          ...tokens,
        };
      } catch (e) {
        this.logger.error(
          '[AuthService.googleLogin] Failed to generate tokens:',
          e,
        );
        throw new InternalServerErrorException(
          'Google login failed: could not issue tokens',
        );
      }
    } catch (e) {
      if (
        e instanceof UnauthorizedException ||
        e instanceof ConflictException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      this.logger.error('[AuthService.googleLogin] Unexpected error:', e);
      throw new InternalServerErrorException('Google login failed');
    }
  }
}
