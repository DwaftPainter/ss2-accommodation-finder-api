import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MailerService } from '@nestjs-modules/mailer';

describe('MailService', () => {
  let service: MailService;
  let mailerService: jest.Mocked<MailerService>;

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get(MailerService) as jest.Mocked<MailerService>;
    jest.clearAllMocks();
  });

  describe('sendMail', () => {
    it('should send mail with template', async () => {
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendMail({
        to: 'test@example.com',
        subject: 'Test Subject',
        template: 'test-template',
        context: { name: 'John' },
      });

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        template: 'test-template',
        context: { name: 'John' },
        text: undefined,
        html: undefined,
        attachments: undefined,
      });
    });

    it('should send mail with text content', async () => {
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendMail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Plain text content',
      });

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        template: undefined,
        context: undefined,
        text: 'Plain text content',
        html: undefined,
        attachments: undefined,
      });
    });

    it('should send mail with HTML content', async () => {
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendMail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>HTML Content</h1>',
      });

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        template: undefined,
        context: undefined,
        text: undefined,
        html: '<h1>HTML Content</h1>',
        attachments: undefined,
      });
    });

    it('should send mail with attachments', async () => {
      mockMailerService.sendMail.mockResolvedValue(undefined);

      const attachments = [
        { filename: 'test.pdf', path: '/path/to/file.pdf' },
        { filename: 'image.png', content: Buffer.from('data') },
      ];

      await service.sendMail({
        to: 'test@example.com',
        subject: 'Test with Attachments',
        attachments,
      });

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test with Attachments',
        template: undefined,
        context: undefined,
        text: undefined,
        html: undefined,
        attachments,
      });
    });

    it('should send mail to multiple recipients', async () => {
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendMail({
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Test Subject',
      });

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Test Subject',
        template: undefined,
        context: undefined,
        text: undefined,
        html: undefined,
        attachments: undefined,
      });
    });

    it('should propagate errors from mailer service', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendMail({
          to: 'test@example.com',
          subject: 'Test',
        }),
      ).rejects.toThrow('SMTP error');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email', async () => {
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendWelcomeEmail('test@example.com', 'John Doe');

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Welcome to Accommodation Finder!',
        template: 'welcome',
        context: { name: 'John Doe' },
        text: undefined,
        html: undefined,
        attachments: undefined,
      });
    });

    it('should send welcome email with empty name', async () => {
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendWelcomeEmail('test@example.com', '');

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Welcome to Accommodation Finder!',
        template: 'welcome',
        context: { name: '' },
        text: undefined,
        html: undefined,
        attachments: undefined,
      });
    });
  });

  describe('sendPasswordResetEmail', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, FRONTEND_URL: 'https://app.example.com' };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should send password reset email', async () => {
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendPasswordResetEmail('test@example.com', 'John', 'reset-token-123');

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Password Reset Request',
        template: 'password-reset',
        context: {
          name: 'John',
          resetUrl: 'https://app.example.com/reset-password?token=reset-token-123',
        },
        text: undefined,
        html: undefined,
        attachments: undefined,
      });
    });

    it('should use FRONTEND_URL environment variable', async () => {
      process.env.FRONTEND_URL = 'https://different-domain.com';
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendPasswordResetEmail('test@example.com', 'John', 'token');

      const callArg = mailerService.sendMail.mock.calls[0][0];
      expect(callArg.context.resetUrl).toContain('https://different-domain.com');
    });
  });

  describe('sendVerificationEmail', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, FRONTEND_URL: 'https://app.example.com' };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should send verification email', async () => {
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendVerificationEmail('test@example.com', 'John', 'verify-token-456');

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Verify Your Email',
        template: 'email-verification',
        context: {
          name: 'John',
          verificationUrl: 'https://app.example.com/verify-email?token=verify-token-456',
        },
        text: undefined,
        html: undefined,
        attachments: undefined,
      });
    });

    it('should use FRONTEND_URL environment variable', async () => {
      process.env.FRONTEND_URL = 'https://custom-domain.com';
      mockMailerService.sendMail.mockResolvedValue(undefined);

      await service.sendVerificationEmail('test@example.com', 'John', 'token');

      const callArg = mailerService.sendMail.mock.calls[0][0];
      expect(callArg.context.verificationUrl).toContain('https://custom-domain.com');
    });
  });
});
