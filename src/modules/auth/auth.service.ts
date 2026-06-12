import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { MailService } from '../../integrations/mail/mail.service';
import {
  OpensearchService,
  UserSearchDoc,
} from '../../integrations/opensearch/opensearch.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AUTH_CODES, authResponse } from './auth.messages';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokenService: TokenService,
    private otpService: OtpService,
    private mailService: MailService,
    private opensearch: OpensearchService,
  ) {}

  async register(data: RegisterDto) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);

      let user: { id: string; email: string; name: string; createdAt: Date };
      try {
        user = await this.prisma.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            name: data.name,
          },
          select: { id: true, email: true, name: true, createdAt: true },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException(authResponse(AUTH_CODES.EMAIL_EXISTS));
        }
        this.logger.error('[AuthService.register] Failed to create user:', e);
        throw e;
      }

      // Index user in OpenSearch (fire and forget)
      this.indexUserInBackground(user);

      try {
        const otp = await this.otpService.generateOtp(user.email);
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
          authResponse(AUTH_CODES.VERIFICATION_EMAIL_FAILED),
        );
      }

      return {
        user,
        ...authResponse(AUTH_CODES.REGISTERED_VERIFICATION_REQUIRED),
      };
    } catch (e) {
      if (
        e instanceof ConflictException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      this.logger.error('[AuthService.register] Unexpected error:', e);
      throw new InternalServerErrorException(
        authResponse(AUTH_CODES.REGISTRATION_FAILED),
      );
    }
  }

  async login(data: LoginDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true, email: true, name: true, password: true },
      });

      const hash = user?.password ?? '$2b$10$invalidhashpadding000000000000';
      const isMatch = await bcrypt.compare(data.password, hash);

      if (!user || !isMatch) {
        throw new UnauthorizedException(
          authResponse(AUTH_CODES.INVALID_CREDENTIALS),
        );
      }

      const { password: _, ...safeUser } = user;

      try {
        const tokens = await this.generateTokens(user.id);
        return {
          user: safeUser,
          ...tokens,
          ...authResponse(AUTH_CODES.LOGIN_SUCCESS),
        };
      } catch (e) {
        this.logger.error('[AuthService.login] Failed to generate tokens:', e);
        throw new InternalServerErrorException(
          authResponse(AUTH_CODES.LOGIN_FAILED),
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
      throw new InternalServerErrorException(
        authResponse(AUTH_CODES.LOGIN_FAILED),
      );
    }
  }

  async refresh(oldToken: string) {
    try {
      const userId = await this.tokenService.resolveRefreshToken(oldToken);
      if (!userId) {
        throw new UnauthorizedException(
          authResponse(AUTH_CODES.INVALID_REFRESH_TOKEN),
        );
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
        throw new InternalServerErrorException(
          authResponse(AUTH_CODES.TOKEN_REFRESH_FAILED),
        );
      }
    } catch (e) {
      if (
        e instanceof UnauthorizedException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      this.logger.error('[AuthService.refresh] Unexpected error:', e);
      throw new InternalServerErrorException(
        authResponse(AUTH_CODES.TOKEN_REFRESH_FAILED),
      );
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
        throw new NotFoundException(authResponse(AUTH_CODES.USER_NOT_FOUND));
      }

      if (user.emailVerified) {
        throw new BadRequestException(
          authResponse(AUTH_CODES.EMAIL_ALREADY_VERIFIED),
        );
      }

      let isValid: boolean;
      try {
        isValid = await this.otpService.verifyOtp(email, otp);
      } catch (e) {
        this.logger.error(
          '[AuthService.verifyEmail] OTP verification service error:',
          e,
        );
        throw new InternalServerErrorException(
          authResponse(AUTH_CODES.OTP_VERIFICATION_FAILED),
        );
      }

      if (!isValid) {
        throw new BadRequestException(
          authResponse(AUTH_CODES.OTP_INVALID_OR_EXPIRED),
        );
      }

      try {
        const updatedUser = await this.prisma.user.update({
          where: { email },
          data: { emailVerified: true },
          select: {
            id: true,
            email: true,
            name: true,
            emailVerified: true,
            createdAt: true,
          },
        });
        // Update OpenSearch index (fire and forget)
        this.indexUserInBackground(updatedUser);
      } catch (e) {
        this.logger.error(
          '[AuthService.verifyEmail] Failed to update emailVerified flag:',
          e,
        );
        throw new InternalServerErrorException(
          authResponse(AUTH_CODES.OTP_VERIFICATION_FAILED),
        );
      }

      const { emailVerified: _, ...safeUser } = user;

      try {
        const tokens = await this.generateTokens(user.id);
        return {
          user: safeUser,
          ...tokens,
          ...authResponse(AUTH_CODES.EMAIL_VERIFIED),
        };
      } catch (e) {
        this.logger.error(
          '[AuthService.verifyEmail] Failed to generate tokens:',
          e,
        );
        throw new InternalServerErrorException(
          authResponse(AUTH_CODES.TOKEN_REFRESH_FAILED),
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
      throw new InternalServerErrorException(
        authResponse(AUTH_CODES.OTP_VERIFICATION_FAILED),
      );
    }
  }

  async resendOtp(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, emailVerified: true },
      });

      if (!user) {
        throw new NotFoundException(authResponse(AUTH_CODES.USER_NOT_FOUND));
      }

      if (user.emailVerified) {
        throw new BadRequestException(
          authResponse(AUTH_CODES.EMAIL_ALREADY_VERIFIED),
        );
      }

      try {
        const otp = await this.otpService.generateOtp(user.email);
        await this.mailService.sendMail({
          to: user.email,
          subject: 'Verify Your Email - Accommodation Finder',
          template: 'verify-otp',
          context: { name: user.name, otp, year: new Date().getFullYear() },
        });

        return authResponse(AUTH_CODES.OTP_RESENT);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('wait before requesting')
        ) {
          throw new BadRequestException(
            authResponse(AUTH_CODES.OTP_RATE_LIMITED),
          );
        }
        this.logger.error(
          '[AuthService.resendOtp] Failed to generate/send OTP:',
          error,
        );
        throw new InternalServerErrorException(
          authResponse(AUTH_CODES.OTP_RESEND_FAILED),
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
      throw new InternalServerErrorException(
        authResponse(AUTH_CODES.OTP_RESEND_FAILED),
      );
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

  private async indexUserInBackground(user: {
    id: string;
    email: string;
    name: string;
    createdAt?: Date;
    emailVerified?: boolean;
  }) {
    const doc: UserSearchDoc = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'user',
      status: 'active',
      emailVerified: user.emailVerified ?? false,
      createdAt: (user.createdAt ?? new Date()).toISOString(),
    };

    try {
      await this.opensearch.indexUser(doc);
      this.logger.log(`Indexed user ${user.id} in OpenSearch`);
    } catch (error) {
      this.logger.warn(`Failed to index user ${user.id}: ${error.message}`);
    }
  }

  async googleLogin(auth0User: GoogleLoginDto) {
    try {
      if (!auth0User.email) {
        throw new UnauthorizedException(
          authResponse(AUTH_CODES.AUTH0_EMAIL_MISSING),
        );
      }

      if (!auth0User.sub) {
        throw new UnauthorizedException(
          authResponse(AUTH_CODES.AUTH0_TOKEN_INVALID),
        );
      }

      const displayName =
        auth0User.name ||
        [auth0User.given_name, auth0User.family_name]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        auth0User.nickname ||
        auth0User.email.split('@')[0];

      let user: {
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        auth0Id: string | null;
        emailVerified: boolean;
        createdAt: Date;
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
            avatarUrl: true,
            auth0Id: true,
            emailVerified: true,
            createdAt: true,
          },
        });
      } catch (e) {
        this.logger.error(
          '[AuthService.googleLogin] Failed to query user from DB:',
          e,
        );
        throw new InternalServerErrorException(
          authResponse(AUTH_CODES.GOOGLE_LOGIN_FAILED),
        );
      }

      if (user) {
        if (!user.auth0Id) {
          try {
            user = await this.prisma.user.update({
              where: { id: user.id },
              data: {
                auth0Id: auth0User.sub,
                avatarUrl: auth0User.picture,
                emailVerified: auth0User.email_verified ?? true,
              },
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                auth0Id: true,
                emailVerified: true,
                createdAt: true,
              },
            });
            // Update OpenSearch index (fire and forget)
            this.indexUserInBackground(user);
          } catch (e) {
            this.logger.error(
              '[AuthService.googleLogin] Failed to update user auth0Id:',
              e,
            );
            throw new InternalServerErrorException(
              authResponse(AUTH_CODES.GOOGLE_LOGIN_FAILED),
            );
          }
        }
      } else {
        try {
          user = await this.prisma.user.create({
            data: {
              email: auth0User.email,
              name: displayName,
              avatarUrl: auth0User.picture,
              auth0Id: auth0User.sub,
              emailVerified: auth0User.email_verified ?? true,
            },
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
              auth0Id: true,
              emailVerified: true,
              createdAt: true,
            },
          });
          // Index new user in OpenSearch (fire and forget)
          this.indexUserInBackground(user);
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            throw new ConflictException(authResponse(AUTH_CODES.EMAIL_EXISTS));
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
            avatarUrl: user.avatarUrl,
          },
          ...tokens,
          ...authResponse(AUTH_CODES.GOOGLE_LOGIN_SUCCESS),
        };
      } catch (e) {
        this.logger.error(
          '[AuthService.googleLogin] Failed to generate tokens:',
          e,
        );
        throw new InternalServerErrorException(
          authResponse(AUTH_CODES.GOOGLE_LOGIN_FAILED),
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
      throw new InternalServerErrorException(
        authResponse(AUTH_CODES.GOOGLE_LOGIN_FAILED),
      );
    }
  }
}
