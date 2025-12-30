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
  UpdateShelterProfileDto,
  UpdateVetProfileDto,
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
    if (fileInstance) {
      updatedUserData.profilePictureUrl = fileInstance.url;
      updatedUserData.profilePicture = { connect: fileInstance };
    }

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

  @HandleError('Failed to update veterinarian profile', 'Veterinarian')
  async updateVetProfile(
    userId: string,
    dto: UpdateVetProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      include: { veterinarians: true },
    });

    if (!user.veterinarians) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Veterinarian profile not found',
      );
    }

    // * if phone is provided, check if it's unique
    if (dto.phone) {
      const existingVet = await this.prisma.client.veterinarian.findFirst({
        where: { phone: dto.phone },
      });
      if (existingVet && existingVet.id !== user.veterinarians.id) {
        throw new AppError(HttpStatus.CONFLICT, 'Phone already in use');
      }
    }

    // * if license is provided, check if it's unique
    if (dto.license) {
      const existingVet = await this.prisma.client.veterinarian.findFirst({
        where: { license: dto.license },
      });
      if (existingVet && existingVet.id !== user.veterinarians.id) {
        throw new AppError(
          HttpStatus.CONFLICT,
          'License number already in use',
        );
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
    if (fileInstance) {
      updatedUserData.profilePicture = { connect: fileInstance };
      updatedUserData.profilePictureUrl = fileInstance.url;
    }

    // Update veterinarian fields
    const updatedVetData: Prisma.VeterinarianUpdateInput = {};
    if (dto.phone) updatedVetData.phone = dto.phone;
    if (dto.license) updatedVetData.license = dto.license;
    if (dto.description) updatedVetData.description = dto.description;

    // Use transaction/update to ensure consistency
    const updatedUser = await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        ...updatedUserData,
        veterinarians: {
          update: updatedVetData,
        },
      },
      include: { veterinarians: true, profilePicture: true },
    });

    return successResponse(
      await this.authUtils.sanitizeUser(updatedUser),
      'Veterinarian profile updated successfully',
    );
  }

  @HandleError('Failed to update shelter profile', 'Shelter')
  async updateShelterProfile(
    userId: string,
    dto: UpdateShelterProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        shelterAdminOf: {
          include: { logo: true },
        },
        managerOf: {
          include: { logo: true },
        },
        profilePictureId: true,
      },
    });

    const shelter = user.shelterAdminOf || user.managerOf;

    if (!shelter) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User is not an admin or manager of any shelter',
      );
    }

    // * if phone is provided, check if it's unique
    if (dto.phone) {
      const existingShelter = await this.prisma.client.shelter.findFirst({
        where: { phone: dto.phone },
      });
      if (existingShelter && existingShelter.id !== shelter.id) {
        throw new AppError(HttpStatus.CONFLICT, 'Phone already in use');
      }
    }

    // Handle logo upload
    let fileInstance: FileInstance | undefined;
    if (file) {
      fileInstance = await this.s3.uploadFile(file);
      if (shelter.logoId) {
        await this.s3.deleteFile(shelter.logoId);
      }
      // if (user.profilePictureId) {
      //   await this.s3.deleteFile(user.profilePictureId);
      // }
    }

    // Prepare update data
    const updateData: Prisma.ShelterUpdateInput = {};
    if (dto.name?.trim()) updateData.name = dto.name.trim();
    if (dto.address) updateData.address = dto.address;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.description) updateData.description = dto.description;
    if (fileInstance) {
      updateData.logo = { connect: fileInstance };
      updateData.logoUrl = fileInstance.url;
      // await this.prisma.client.user.update({
      //   where: { id: user.id },
      //   data: {
      //     profilePicture: {
      //       connect: {
      //         id: fileInstance.id,
      //       },
      //     },
      //     profilePictureUrl: fileInstance.url,
      //   },
      // });
    }

    const updatedShelter = await this.prisma.client.shelter.update({
      where: { id: shelter.id },
      data: updateData,
      include: { logo: true },
    });

    return successResponse(
      updatedShelter,
      'Shelter profile updated successfully',
    );
  }
}
