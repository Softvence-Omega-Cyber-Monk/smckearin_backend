import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { RegisterDto, RegisterType } from '../dto/register.dto';

@Injectable()
export class AuthRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
  ) {}

  @HandleError('Failed to register user')
  async register(dto: RegisterDto) {
    if (!dto.shelterName && dto.type === RegisterType.SHELTER) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Shelter name is required');
    }

    // Check email availability
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new AppError(HttpStatus.CONFLICT, 'Email already in use');
    }

    // Hash password
    const hashedPassword = await this.utils.hash(dto.password);

    // Shelter registration
    if (dto.type === RegisterType.SHELTER) {
      const result = await this.prisma.client.$transaction(async (tx) => {
        const shelter = await tx.shelter.create({
          data: { name: dto?.shelterName ?? `Pet Shelter of ${dto.name}` },
        });

        const user = await tx.user.create({
          data: {
            email: dto.email,
            password: hashedPassword,
            name: dto.name,
            role: 'SHELTER_ADMIN',
            shelterAdminOf: { connect: { id: shelter.id } },
          },
        });

        return { shelter, user };
      });

      const sanitizedUser = await this.utils.sanitizeUser(result.user);
      return successResponse(
        { shelter: result.shelter, user: sanitizedUser },
        'Shelter admin registered successfully',
      );
    }

    // Vet registration
    if (dto.type === RegisterType.VET) {
      const result = await this.prisma.client.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            password: hashedPassword,
            name: dto.name,
            role: 'VETERINARIAN',
          },
        });

        const vet = await tx.veterinarian.create({
          data: { user: { connect: { id: user.id } } },
        });

        return { user, vet };
      });

      const sanitizedUser = await this.utils.sanitizeUser(result.user);
      return successResponse(
        { vet: result.vet, user: sanitizedUser },
        'Veterinarian registered successfully',
      );
    }

    // Invalid type
    throw new AppError(HttpStatus.BAD_REQUEST, 'Invalid registration type');
  }
}
