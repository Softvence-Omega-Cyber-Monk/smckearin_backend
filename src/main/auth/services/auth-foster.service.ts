import { UserEnum } from '@/common/enum/user.enum';
import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ForgotPasswordDto } from '../dto/password.dto';
import { FosterRegisterDto } from '../dto/foster-register.dto';
import { FosterResetPasswordDto } from '../dto/foster-reset-password.dto';

@Injectable()
export class AuthFosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
    private readonly mailService: AuthMailService,
  ) {}

  @HandleError('Failed to register foster')
  async register(dto: FosterRegisterDto): Promise<TResponse<any>> {
    const userDelegate = (this.prisma.client as any).user;

    if (dto.accountType !== UserEnum.FOSTER) {
      throw new AppError(400, 'Only foster registration is allowed');
    }

    if (dto.password !== dto.confirmPassword) {
      throw new AppError(400, 'Passwords do not match');
    }

    const existingUser = await userDelegate.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new AppError(409, 'Email already in use');
    }

    const hashedPassword = await this.authUtils.hash(dto.password);
    const emailVerificationToken = randomBytes(32).toString('hex');
    const emailVerificationExpiry = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    const user = await userDelegate.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.fullName,
        role: UserEnum.FOSTER,
        phone: dto.phone,
        city: dto.city,
        state: dto.state,
        address: dto.address,
        status: 'PENDING_VERIFICATION',
        isVerified: false,
        isEmailVerified: false,
        emailVerificationToken,
        emailVerificationExpiry,
        notificationSettings: {
          create: {},
        },
      },
    });

    await this.mailService.sendVerificationEmail(
      user.email,
      user.name,
      emailVerificationToken,
    );

    return successResponse(
      {
        message:
          'Registration successful. Please check your email to verify your account.',
        userId: user.id,
      },
      'Foster registered successfully',
    );
  }

  @HandleError('Failed to verify foster email')
  async verifyEmail(token: string): Promise<TResponse<any>> {
    const userDelegate = (this.prisma.client as any).user;

    if (!token) {
      throw new AppError(400, 'Verification token is required');
    }

    const user = await userDelegate.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: { gt: new Date() },
        role: UserEnum.FOSTER,
      },
    });

    if (!user) {
      throw new AppError(400, 'Invalid or expired verification token');
    }

    await userDelegate.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        isEmailVerified: true,
        status: 'PENDING_APPROVAL',
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    return successResponse(
      null,
      'Email verified successfully. Your account is pending admin approval.',
    );
  }

  @HandleError('Failed to send foster password reset email')
  async forgotPassword(dto: ForgotPasswordDto): Promise<TResponse<any>> {
    const userDelegate = (this.prisma.client as any).user;
    const passwordResetTokenDelegate = (this.prisma.client as any)
      .passwordResetToken;
    const successMessage = successResponse(
      null,
      'If this email is registered, a password reset link has been sent.',
    );

    const user = await userDelegate.findFirst({
      where: {
        email: dto.email,
        role: { in: [UserEnum.FOSTER, UserEnum.FOSTER_ADMIN] },
      },
    });

    if (!user) {
      return successMessage;
    }

    await passwordResetTokenDelegate.deleteMany({
      where: { userId: user.id },
    });

    const token = randomBytes(32).toString('hex');
    await passwordResetTokenDelegate.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await this.mailService.sendPasswordResetEmail(user.email, user.name, token);

    return successMessage;
  }

  @HandleError('Failed to reset foster password')
  async resetPassword(dto: FosterResetPasswordDto): Promise<TResponse<any>> {
    const userDelegate = (this.prisma.client as any).user;
    const passwordResetTokenDelegate = (this.prisma.client as any)
      .passwordResetToken;

    const resetToken = await passwordResetTokenDelegate.findFirst({
      where: {
        token: dto.token,
        used: false,
        expiresAt: { gt: new Date() },
        user: {
          role: { in: [UserEnum.FOSTER, UserEnum.FOSTER_ADMIN] },
        },
      },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      throw new AppError(400, 'Invalid or expired reset token');
    }

    const hashedPassword = await this.authUtils.hash(dto.newPassword);

    await userDelegate.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    await passwordResetTokenDelegate.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    return successResponse(null, 'Password reset successful. You can now log in.');
  }

  @HandleError('Failed to get foster registration status')
  async getRegistrationStatus(userId: string): Promise<TResponse<any>> {
    const user = await (this.prisma.client as any).user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return successResponse(
      {
        status: user.status,
        estimatedApprovalHours: 48,
      },
      'Foster registration status fetched successfully',
    );
  }
}
