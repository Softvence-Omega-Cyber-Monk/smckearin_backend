import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class AuthRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authMailService: AuthMailService,
    private readonly utils: AuthUtilsService,
  ) {}

  @HandleError('Registration failed', 'User')
  async register(dto: RegisterDto): Promise<TResponse<any>> {
    const { email, password, name } = dto;

    // Check if user email already exists
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new AppError(400, 'User already exists with this email');
    }

    // Create new user
    const newUser = await this.prisma.client.user.create({
      data: {
        email,
        name,
        password: await this.utils.hash(password),
      },
    });

    // Generate OTP and save
    const otp = await this.utils.generateOTPAndSave(newUser.id, 'VERIFICATION');

    // Send verification email
    await this.authMailService.sendVerificationCodeEmail(
      email,
      otp.toString(),
      {
        subject: 'Verify your email',
        message:
          'Welcome to our platform! Your account has been successfully created.',
      },
    );

    // Return sanitized response
    return successResponse(
      {
        email: newUser.email,
      },
      `Registration successful. A verification email has been sent to ${newUser.email}.`,
    );
  }
}
