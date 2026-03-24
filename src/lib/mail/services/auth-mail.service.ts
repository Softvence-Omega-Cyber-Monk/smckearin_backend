import { ENVEnum } from '@/common/enum/env.enum';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpType } from '@prisma';
import * as he from 'he';
import * as nodemailer from 'nodemailer';
import { MailService } from '../mail.service';
import { invitationTemplate } from '../templates/invitation.template';
import { otpTemplate } from '../templates/otp.template';
import { passwordResetConfirmationTemplate } from '../templates/reset-password-confirm.template';
import { resetPasswordLinkTemplate } from '../templates/reset-password-link.template';
import { shelterInvitationTemplate } from '../templates/shelter-invitation.template';

interface EmailOptions {
  subject?: string;
  message?: string;
}

@Injectable()
export class AuthMailService {
  private readonly frontendUrl: string;
  private readonly appUrl: string;
  constructor(
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.getOrThrow<string>(ENVEnum.FRONTEND_URL);
    this.appUrl =
      this.config.get<string>(ENVEnum.APP_URL) ??
      this.config.get<string>(ENVEnum.BASE_URL) ??
      this.frontendUrl;
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<nodemailer.SentMessageInfo> {
    return this.mailService.sendMail({ to, subject, html, text });
  }

  private sanitize(input: string) {
    return he.encode(input);
  }

  async sendVerificationCodeEmail(
    to: string,
    code: string,
    options: EmailOptions = {},
  ): Promise<nodemailer.SentMessageInfo> {
    const message = this.sanitize(options.message || 'Verify your account');
    const safeCode = this.sanitize(code);
    const subject = options.subject || 'Verification Code';

    return this.sendEmail(
      to,
      subject,
      otpTemplate({
        title: '🔑 Verify Your Account',
        message,
        code: safeCode,
        footer:
          'If you didn’t request this code, you can safely ignore this email.',
      }),
      `${message}\nYour verification code: ${code}`,
    );
  }

  async sendResetPasswordCodeEmail(
    to: string,
    code: string,
    options: EmailOptions = {},
  ): Promise<nodemailer.SentMessageInfo> {
    const message = this.sanitize(options.message || 'Password Reset Request');
    const safeCode = this.sanitize(code);
    const subject = options.subject || 'Password Reset Code';

    const resetLink = `${this.frontendUrl}/reset-password?code=${code}&type=${OtpType.RESET}&email=${to}`;

    return this.sendEmail(
      to,
      subject,
      resetPasswordLinkTemplate({
        title: '🔒 Password Reset Request',
        message,
        code: safeCode,
        footer:
          'If you didn’t request a password reset, you can safely ignore this email.',
        link: resetLink,
      }),
      `${message}\nReset your password using this link: ${resetLink}`,
    );
  }

  async sendPasswordResetConfirmationEmail(
    to: string,
    options: EmailOptions = {},
  ): Promise<nodemailer.SentMessageInfo> {
    const message = this.sanitize(
      options.message || 'Password Reset Confirmation',
    );
    const subject = options.subject || 'Password Reset Confirmation';

    return this.sendEmail(
      to,
      subject,
      passwordResetConfirmationTemplate(message),
      message,
    );
  }

  async sendAdminInvitationEmail(
    to: string,
    name: string,
    password: string,
    options: EmailOptions = {},
  ): Promise<nodemailer.SentMessageInfo> {
    const subject = options.subject || 'Invitation to Join Administration Team';
    const loginLink = `${this.frontendUrl}/login`;

    return this.sendEmail(
      to,
      subject,
      invitationTemplate({
        title: 'Welcome to the Team',
        name,
        email: to,
        password,
        loginLink,
        footer: 'Please do not share your credentials with anyone.',
      }),
      `You have been invited as an Admin.\nEmail: ${to}\nPassword: ${password}\nLogin here: ${loginLink}`,
    );
  }

  async sendShelterInvitationEmail(
    to: string,
    name: string,
    shelterName: string,
    password: string,
    options: EmailOptions = {},
  ): Promise<nodemailer.SentMessageInfo> {
    const subject = options.subject || `Invitation to Join ${shelterName}`;
    const loginLink = `${this.frontendUrl}/login`;

    return this.sendEmail(
      to,
      subject,
      shelterInvitationTemplate({
        title: 'Welcome to the Shelter',
        name,
        shelterName,
        email: to,
        password,
        loginLink,
        footer: 'Please do not share your credentials with anyone.',
      }),
      `You have been invited to join ${shelterName}.\nEmail: ${to}\nPassword: ${password}\nLogin here: ${loginLink}`,
    );
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<nodemailer.SentMessageInfo> {
    const link = `${this.appUrl}/auth/foster/verify-email?token=${token}`;
    const safeName = this.sanitize(name);

    return this.sendEmail(
      to,
      'Verify your Rescue Transit account',
      `<p>Hi <strong>${safeName}</strong>,</p><p>Please verify your email by clicking the link below:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
      `Hi ${name},\n\nPlease verify your email:\n${link}\n\nThis link expires in 24 hours.`,
    );
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<nodemailer.SentMessageInfo> {
    const link = `${this.appUrl}/auth/foster/reset-password?token=${token}`;
    const safeName = this.sanitize(name);

    return this.sendEmail(
      to,
      'Reset your Rescue Transit password',
      `<p>Hi <strong>${safeName}</strong>,</p><p>Click the link below to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`,
      `Hi ${name},\n\nClick the link to reset your password:\n${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    );
  }

  async sendApprovalNotification(
    to: string,
    name: string,
  ): Promise<nodemailer.SentMessageInfo> {
    const safeName = this.sanitize(name);

    return this.sendEmail(
      to,
      'Your Rescue Transit account has been approved!',
      `<p>Hi <strong>${safeName}</strong>,</p><p>Your foster account has been approved.</p><p>You can now log in at <a href="${this.appUrl}">${this.appUrl}</a>.</p>`,
      `Hi ${name},\n\nYour foster account has been approved.\n\nYou can now log in at ${this.appUrl}`,
    );
  }
}
