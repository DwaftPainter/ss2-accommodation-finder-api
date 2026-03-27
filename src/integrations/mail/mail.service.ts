import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

interface SendMailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  context?: Record<string, unknown>;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendMail(options: SendMailOptions): Promise<void> {
    const { to, subject, template, context, text, html, attachments } = options;

    await this.mailerService.sendMail({
      to,
      subject,
      template,
      context,
      text,
      html,
      attachments,
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Welcome to Accommodation Finder!',
      template: 'welcome',
      context: { name },
    });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await this.sendMail({
      to,
      subject: 'Password Reset Request',
      template: 'password-reset',
      context: { name, resetUrl },
    });
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    verificationToken: string,
  ): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await this.sendMail({
      to,
      subject: 'Verify Your Email',
      template: 'email-verification',
      context: { name, verificationUrl },
    });
  }
}
