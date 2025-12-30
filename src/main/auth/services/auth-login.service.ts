import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
  ) {}

  @HandleError('Login failed', 'User')
  async login(dto: LoginDto): Promise<TResponse<any>> {
    const { email, password } = dto;

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { email },
    });

    // Check password
    const isPasswordCorrect = await this.utils.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new AppError(400, 'Invalid password');
    }

    // Update login activity
    const updatedUser = await this.prisma.client.user.update({
      where: { email },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      },
      include: {
        drivers: true,
        shelterAdminOf: true,
        managerOf: true,
        profilePicture: true,
        veterinarians: true,
      },
    });

    // Generate token
    const token = await this.utils.generateTokenPairAndSave({
      email,
      role: updatedUser.role,
      sub: updatedUser.id,
    });

    // Determine login type
    const loginType = this.getLoginType(updatedUser.role);

    // Determine dynamic isApproved
    let isApproved = true;

    switch (updatedUser.role) {
      case 'DRIVER':
        if (updatedUser.drivers) {
          // A driver is approved only if their overall status is APPROVED
          isApproved = updatedUser.drivers.status === 'APPROVED';
        } else {
          isApproved = false;
        }
        break;

      case 'VETERINARIAN':
        if (updatedUser.veterinarians) {
          // A vet is approved only if their overall status is APPROVED
          isApproved = updatedUser.veterinarians.status === 'APPROVED';
        } else {
          isApproved = false;
        }
        break;

      case 'SHELTER_ADMIN':
        if (updatedUser.shelterAdminOf) {
          // Check the shelter's approval status
          isApproved = updatedUser.shelterAdminOf.status === 'APPROVED';
        } else {
          isApproved = false;
        }
        break;

      case 'MANAGER':
        if (updatedUser.managerOf) {
          // Check the shelter managed by the user
          isApproved = updatedUser.managerOf.status === 'APPROVED';
        } else {
          isApproved = false;
        }
        break;

      default:
        isApproved = true;
    }

    return successResponse(
      {
        user: await this.utils.sanitizeUser(updatedUser),
        loginType,
        isApproved,
        role: updatedUser.role,
        token,
      },
      'Logged in successfully',
    );
  }

  private getLoginType(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return 'SYSTEM';
      case 'SHELTER_ADMIN':
      case 'MANAGER':
        return 'SHELTER';
      case 'VETERINARIAN':
        return 'VET';
      case 'DRIVER':
        return 'DRIVER';
      default:
        return 'UNKNOWN';
    }
  }
}
