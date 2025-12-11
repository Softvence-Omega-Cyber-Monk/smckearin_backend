import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ShelterRegisterDto } from '../dto/register.dto';

@Injectable()
export class AuthRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
  ) {}

  @HandleError('Failed to register')
  async shelterRegister(dto: ShelterRegisterDto) {
    // * Validate email
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new AppError(HttpStatus.CONFLICT, 'Email already in use');
    }

    // * Hash password
    const hashedPassword = await this.utils.hash(dto.password);

    // * Create Shelter with admin user (atomic transaction)
    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create shelter first
      const shelter = await tx.shelter.create({
        data: {
          name: dto.shelterName,
        },
      });

      // Create admin user for this shelter
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          name: dto.name,
          role: 'SHELTER_ADMIN',
          shelterAdminOf: {
            connect: { id: shelter.id },
          },
        },
      });

      return { shelter, user };
    });

    const sanitizedUser = await this.utils.sanitizeUser(result.user);

    return successResponse(
      {
        shelter: result.shelter,
        user: sanitizedUser,
      },
      'User registered successfully',
    );
  }
}
