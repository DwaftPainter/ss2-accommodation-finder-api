import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { MailService } from '../../integrations/mail/mail.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let tokenService: jest.Mocked<TokenService>;
  let otpService: jest.Mocked<OtpService>;
  let mailService: jest.Mocked<MailService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedpassword',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('access-token'),
          },
        },
        {
          provide: TokenService,
          useValue: {
            createRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
            resolveRefreshToken: jest.fn(),
            rotateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
            deleteRefreshToken: jest.fn(),
            deleteAllUserTokens: jest.fn(),
          },
        },
        {
          provide: OtpService,
          useValue: {
            generateOtp: jest.fn().mockResolvedValue('123456'),
            verifyOtp: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    tokenService = module.get(TokenService) as jest.Mocked<TokenService>;
    otpService = module.get(OtpService) as jest.Mocked<OtpService>;
    mailService = module.get(MailService) as jest.Mocked<MailService>;

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    it('should register a new user successfully', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      prisma.user.create = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: registerDto.email,
        name: registerDto.name,
      });

      const result = await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          password: 'hashedpassword',
          name: registerDto.name,
        },
        select: { id: true, email: true, name: true },
      });
      expect(otpService.generateOtp).toHaveBeenCalledWith(registerDto.email);
      expect(mailService.sendMail).toHaveBeenCalled();
      expect(result).toEqual({
        user: { id: 'user-1', email: registerDto.email, name: registerDto.name },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        message: 'Please check your email for the verification code',
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '4.0.0',
      });
      prisma.user.create = jest.fn().mockRejectedValue(error);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-unique constraint errors', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      const error = new Error('Database error');
      prisma.user.create = jest.fn().mockRejectedValue(error);

      await expect(service.register(registerDto)).rejects.toThrow('Database error');
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
        select: { id: true, email: true, name: true, password: true },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
      expect(result).toEqual({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      tokenService.resolveRefreshToken = jest.fn().mockResolvedValue('user-1');

      const result = await service.refresh('old-refresh-token');

      expect(tokenService.resolveRefreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(tokenService.rotateRefreshToken).toHaveBeenCalledWith('old-refresh-token', 'user-1');
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1' });
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      tokenService.resolveRefreshToken = jest.fn().mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      await service.logout('refresh-token', 'user-1');

      expect(tokenService.deleteRefreshToken).toHaveBeenCalledWith('refresh-token', 'user-1');
    });
  });

  describe('logoutAll', () => {
    it('should logout user from all devices', async () => {
      await service.logoutAll('user-1');

      expect(tokenService.deleteAllUserTokens).toHaveBeenCalledWith('user-1');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      });
      otpService.verifyOtp = jest.fn().mockResolvedValue(true);
      prisma.user.update = jest.fn().mockResolvedValue({});

      const result = await service.verifyEmail('test@example.com', '123456');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: { id: true, email: true, name: true, emailVerified: true },
      });
      expect(otpService.verifyOtp).toHaveBeenCalledWith('test@example.com', '123456');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: { emailVerified: true },
      });
      expect(result).toEqual({ message: 'Email verified successfully' });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.verifyEmail('test@example.com', '123456')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if email already verified', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
      });

      await expect(service.verifyEmail('test@example.com', '123456')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if OTP is invalid', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      });
      otpService.verifyOtp = jest.fn().mockResolvedValue(false);

      await expect(service.verifyEmail('test@example.com', '123456')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendOtp', () => {
    it('should resend OTP successfully', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      });

      const result = await service.resendOtp('test@example.com');

      expect(otpService.generateOtp).toHaveBeenCalledWith('test@example.com');
      expect(mailService.sendMail).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Verification code sent successfully' });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.resendOtp('test@example.com')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if email already verified', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
      });

      await expect(service.resendOtp('test@example.com')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on rate limit error', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      });
      otpService.generateOtp = jest.fn().mockRejectedValue(new Error('rate limit'));

      await expect(service.resendOtp('test@example.com')).rejects.toThrow(BadRequestException);
    });
  });
});
