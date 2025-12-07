import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authMailService: AuthMailService,
    private readonly utils: AuthUtilsService,
  ) {}

  @HandleError('Login failed', 'User')
  async login(dto: LoginDto): Promise<TResponse<any>> {
    const { email, password } = dto;

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { email },
    });

    const isPasswordCorrect = await this.utils.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new AppError(400, 'Invalid password');
    }

    // 1. Email verification
    if (!user.isVerified) {
      const otp = await this.utils.generateOTPAndSave(user.id, 'VERIFICATION');

      await this.authMailService.sendVerificationCodeEmail(
        user.email,
        otp.toString(),
      );

      return successResponse(
        { email: user.email },
        'Your email is not verified. A new OTP has been sent to your email.',
      );
    }

    // 2. Regular login
    const updatedUser = await this.prisma.client.user.update({
      where: { email },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    // 3. Generate token
    const token = await this.utils.generateTokenPairAndSave({
      email,
      role: updatedUser.role,
      sub: updatedUser.id,
    });

    return successResponse(
      {
        user: await this.utils.sanitizeUser(updatedUser),
        token,
      },
      'Logged in successfully',
    );
  }
}
