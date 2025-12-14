import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { FileInstance, Prisma } from '@prisma';
import {
  UpdateDriverProfileDto,
  UpdateProfileDto,
} from '../dto/update-profile.dto';

@Injectable()
export class AuthUpdateProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
    private readonly s3: S3Service,
  ) {}

  @HandleError('Failed to update profile', 'User')
  async updateProfile(
    authUser: JWTPayload,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: authUser.sub },
    });

    if (user.role === 'VETERINARIAN' || user.role === 'DRIVER') {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Drivers and veterinarians cannot update this profile',
      );
    }

    // Handle image upload
    let fileInstance: FileInstance | undefined;
    if (file) {
      fileInstance = await this.s3.uploadFile(file);
      if (user.profilePictureId) {
        await this.s3.deleteFile(user.profilePictureId);
      }
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        name: dto.name?.trim() || user.name,
        ...(fileInstance && { profilePicture: { connect: fileInstance } }),
      },
      include: { profilePicture: true },
    });

    return successResponse(
      await this.authUtils.sanitizeUser(updatedUser),
      'Profile updated successfully',
    );
  }

  @HandleError('Failed to update driver profile', 'Driver')
  async updateDriverProfile(
    userId: string,
    dto: UpdateDriverProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      include: { drivers: true },
    });

    if (!user.drivers) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Driver profile not found');
    }

    // * if phone is provided, check if it's unique
    if (dto.phone) {
      const existingDriver = await this.prisma.client.driver.findFirst({
        where: { phone: dto.phone },
      });
      if (existingDriver && existingDriver.id !== user.drivers.id) {
        throw new AppError(HttpStatus.CONFLICT, 'Phone already in use');
      }
    }

    // Handle image upload
    let fileInstance: FileInstance | undefined;
    if (file) {
      fileInstance = await this.s3.uploadFile(file);
      if (user.profilePictureId) {
        await this.s3.deleteFile(user.profilePictureId);
      }
    }

    // Update user fields
    const updatedUserData: Prisma.UserUpdateInput = {};
    if (dto.name?.trim()) updatedUserData.name = dto.name.trim();
    if (fileInstance)
      updatedUserData.profilePicture = { connect: fileInstance };

    // Update driver fields
    const updatedDriverData: Prisma.DriverUpdateInput = {};
    if (dto.phone) updatedDriverData.phone = dto.phone;
    if (dto.state) updatedDriverData.state = dto.state;
    if (dto.address) updatedDriverData.address = dto.address;
    if (dto.vehicleType) updatedDriverData.vehicleType = dto.vehicleType;
    if (dto.vehicleCapacity !== undefined)
      updatedDriverData.vehicleCapacity = dto.vehicleCapacity;
    if (dto.yearsOfExperience !== undefined)
      updatedDriverData.yearsOfExperience = dto.yearsOfExperience;
    if (dto.previousExperience)
      updatedDriverData.previousExperience = dto.previousExperience;

    const updatedUser = await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        ...updatedUserData,
        drivers: {
          update: updatedDriverData,
        },
      },
      include: { drivers: true, profilePicture: true },
    });

    return successResponse(
      await this.authUtils.sanitizeUser(updatedUser),
      'Driver profile updated successfully',
    );
  }
}
