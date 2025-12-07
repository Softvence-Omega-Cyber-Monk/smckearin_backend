import { UserResponseDto } from '@/common/dto/user-response.dto';
import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { OtpType, Prisma } from '@prisma';
import { ResendOtpDto, VerifyOTPDto } from '../dto/otp.dto';

@Injectable()
export class AuthOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
    private readonly authMailService: AuthMailService,
  ) {}

  @HandleError('Failed to resend OTP')
  async resendOtp({ email, type }: ResendOtpDto): Promise<TResponse<any>> {
    // 1. Find user
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user) throw new AppError(404, 'User not found');

    if (user.isVerified && type === OtpType.VERIFICATION) {
      throw new AppError(400, 'User is already verified');
    }

    // 2. Delete existing unexpired OTPs of this type
    await this.prisma.client.userOtp.deleteMany({
      where: {
        userId: user.id,
        type,
        expiresAt: { gt: new Date() },
      },
    });

    // 3. Generate new OTP and hash
    const otp = await this.utils.generateOTPAndSave(user.id, type);

    // 4. Send email
    try {
      if (type === OtpType.VERIFICATION) {
        await this.authMailService.sendVerificationCodeEmail(
          email,
          otp.toString(),
          {
            subject: 'Your OTP Code',
            message: `Here is your OTP code. It will expire in 5 minutes.`,
          },
        );
      }

      if (type === OtpType.RESET) {
        await this.authMailService.sendResetPasswordCodeEmail(
          email,
          otp.toString(),
          {
            subject: 'Your OTP Code',
            message: `Here is your OTP code. It will expire in 5 minutes.`,
          },
        );
      }
    } catch (err) {
      console.error(err);
      // Clean up in case email fails
      await this.prisma.client.userOtp.deleteMany({
        where: { userId: user.id, type },
      });
      throw new AppError(
        500,
        'Failed to send OTP email. Please try again later.',
      );
    }

    return successResponse(null, `${type} OTP sent successfully`);
  }

  @HandleError('OTP verification failed', 'User')
  async verifyOTP(
    dto: VerifyOTPDto,
    type: OtpType = OtpType.VERIFICATION,
  ): Promise<TResponse<any>> {
    const { email, otp } = dto;

    // 1. Find user
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user) throw new AppError(404, 'User not found');

    // 2. Find latest OTP for user and type
    const userOtp = await this.prisma.client.userOtp.findFirst({
      where: { userId: user.id, type },
      orderBy: { createdAt: 'desc' },
    });

    if (!userOtp)
      throw new AppError(400, 'OTP is not set. Please request a new one.');

    if (userOtp.expiresAt < new Date()) {
      // Expired -> delete
      await this.prisma.client.userOtp.delete({ where: { id: userOtp.id } });
      throw new AppError(400, 'OTP has expired. Please request a new one.');
    }

    const isCorrectOtp = await this.utils.compare(otp, userOtp.code);
    if (!isCorrectOtp) throw new AppError(400, 'Invalid OTP');

    // 3. OTP verified -> delete OTP
    await this.prisma.client.userOtp.deleteMany({
      where: { userId: user.id, type },
    });

    // 4. Mark user verified if verification OTP
    const updateData: Prisma.UserUpdateInput = {
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
    };
    if (type === OtpType.VERIFICATION) {
      updateData.isVerified = true;
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: user.id },
      data: updateData,
      include: { profilePicture: true },
    });

    // 5. Generate token
    const token = await this.utils.generateTokenPairAndSave({
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    return successResponse(
      {
        user: await this.utils.sanitizeUser<UserResponseDto>(updatedUser),
        token,
      },
      'OTP verified successfully',
    );
  }
}
