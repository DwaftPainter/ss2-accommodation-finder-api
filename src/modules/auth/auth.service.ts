import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { MailService } from '../../integrations/mail/mail.service';
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
    private otpService: OtpService,
    private mailService: MailService,
  ) {}

  async register(data: RegisterDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    console.log(
      '🚀 ~ AuthService ~ register ~ hashedPassword:',
      hashedPassword,
    );

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
    await this.mailService.sendMail({
      to: user.email,
      subject: 'Verify Your Email - Accommodation Finder',
      template: 'verify-otp',
      context: { name: user.name, otp, year: new Date().getFullYear() },
    });

    return {
      user,
      ...(await this.generateTokens(user.id)),
      message: 'Please check your email for the verification code',
    };
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, email: true, name: true, password: true },
    });
    console.log('🚀 ~ AuthService ~ login ~ user:', user)

    const hash = user?.password ?? '$2b$10$invalidhashpadding000000000000';
    console.log('🚀 ~ AuthService ~ login ~ hash:', hash)
    console.log('🚀 ~ AuthService ~ login ~ data.password:', data.password)
    const isMatch = await bcrypt.compare(data.password, hash);
    
    console.log("Track")

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

    return { message: 'Email verified successfully' };
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
        context: { name: user.name, otp },
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
}
