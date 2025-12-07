import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { OtpType } from '@prisma';
import { ChangePasswordDto, ResetPasswordDto } from '../dto/password.dto';

@Injectable()
export class AuthPasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
    private readonly mailService: AuthMailService,
  ) {}

  @HandleError('Failed to change password')
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<TResponse<any>> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!user) throw new AppError(404, 'User not found');

    // If user registered via social login and has no password set
    if (!user.password) {
      const hashedPassword = await this.utils.hash(dto.newPassword);
      await this.prisma.client.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
      return successResponse(null, 'Password set successfully');
    }

    // Normal users must provide current password
    if (!dto.password) throw new AppError(400, 'Current password is required');

    const isValid = await this.utils.compare(dto.password, user.password);
    if (!isValid) throw new AppError(400, 'Invalid current password');

    const hashedPassword = await this.utils.hash(dto.newPassword);
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return successResponse(null, 'Password updated successfully');
  }

  @HandleError('Failed to send password reset email')
  async forgotPassword(email: string): Promise<TResponse<any>> {
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user) throw new AppError(404, 'User not found');

    // Delete existing unexpired RESET OTPs
    await this.prisma.client.userOtp.deleteMany({
      where: {
        userId: user.id,
        type: OtpType.RESET,
        expiresAt: { gt: new Date() },
      },
    });

    // Generate OTP and save
    const otp = await this.utils.generateOTPAndSave(user.id, OtpType.RESET);

    // Send OTP email
    await this.mailService.sendResetPasswordCodeEmail(email, otp.toString());

    return successResponse(null, 'Password reset OTP sent');
  }

  @HandleError('Failed to reset password')
  async resetPassword(dto: ResetPasswordDto): Promise<TResponse<any>> {
    const { otp, email, newPassword } = dto;
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user) throw new AppError(404, 'User not found');

    // Find latest RESET OTP
    const userOtp = await this.prisma.client.userOtp.findFirst({
      where: { userId: user.id, type: OtpType.RESET },
      orderBy: { createdAt: 'desc' },
    });

    if (!userOtp)
      throw new AppError(400, 'OTP is not set. Please request a new one.');
    if (userOtp.expiresAt < new Date()) {
      await this.prisma.client.userOtp.delete({ where: { id: userOtp.id } });
      throw new AppError(401, 'OTP has expired. Please request a new one.');
    }

    const isValid = await this.utils.compare(otp, userOtp.code);
    if (!isValid) throw new AppError(403, 'Invalid OTP');

    // Hash new password
    const hashedPassword = await this.utils.hash(newPassword);

    // Update password and delete OTP
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    await this.prisma.client.userOtp.delete({ where: { id: userOtp.id } });

    // Send confirmation email
    await this.mailService.sendPasswordResetConfirmationEmail(email);

    return successResponse(null, 'Password reset successfully');
  }
}
