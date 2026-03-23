import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
    private readonly mailService: AuthMailService,
  ) {}

  @HandleError('Failed to get foster profile')
  async getProfile(userId: string) {
    const user = await (this.prisma.client as any).user.findUnique({
      where: { id: userId },
      include: {
        fosterProfile: true,
        settings: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return successResponse(
      {
        id: user.id,
        fullName: user.name,
        email: user.email,
        phone: user.phone ?? null,
        city: user.city ?? null,
        state: user.state ?? null,
        address: user.address ?? null,
        profilePhotoUrl:
          user.profilePhotoUrl ?? user.profilePictureUrl ?? null,
        accountType: user.role,
        status: user.status,
        settings: user.settings,
        fosterProfile: {
          weeklyHoursOpen: user.fosterProfile?.weeklyHoursOpen ?? null,
          maxAnimalsAtOnce: user.fosterProfile?.maxAnimalsAtOnce ?? 1,
        },
      },
      'Profile fetched successfully',
    );
  }

  @HandleError('Failed to update foster profile')
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const userDelegate = (this.prisma.client as any).user;
    const user = await userDelegate.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.email && dto.email !== user.email) {
      const existingUser = await userDelegate.findUnique({
        where: { email: dto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }

      const emailVerificationToken = randomBytes(32).toString('hex');
      const emailVerificationExpiry = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      );

      updateData.email = dto.email;
      updateData.isEmailVerified = false;
      updateData.isVerified = false;
      updateData.emailVerificationToken = emailVerificationToken;
      updateData.emailVerificationExpiry = emailVerificationExpiry;

      await this.mailService.sendVerificationEmail(
        dto.email,
        dto.fullName?.trim() || user.name,
        emailVerificationToken,
      );
    }

    if (dto.fullName?.trim()) updateData.name = dto.fullName.trim();
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.state !== undefined) updateData.state = dto.state;
    if (dto.address !== undefined) updateData.address = dto.address;

    const updatedUser = await userDelegate.update({
      where: { id: userId },
      data: updateData,
    });

    return successResponse(
      {
        id: updatedUser.id,
        fullName: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone ?? null,
        city: updatedUser.city ?? null,
        state: updatedUser.state ?? null,
        address: updatedUser.address ?? null,
        profilePhotoUrl:
          updatedUser.profilePhotoUrl ?? updatedUser.profilePictureUrl ?? null,
        accountType: updatedUser.role,
        status: updatedUser.status,
      },
      'Profile updated successfully',
    );
  }

  @HandleError('Failed to update foster password')
  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new AppError(400, 'Passwords do not match');
    }

    const user = await (this.prisma.client as any).user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const isValidPassword = await this.authUtils.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await this.authUtils.hash(dto.newPassword);

    await (this.prisma.client as any).user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return successResponse(
      { message: 'Password updated successfully.' },
      'Password updated successfully',
    );
  }
}
