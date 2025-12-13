import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { FileInstance } from '@prisma';
import { DriverRegisterDto } from '../dto/driver-register.dto';
import { RegisterDto, RegisterType } from '../dto/register.dto';

@Injectable()
export class AuthRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
    private readonly s3: S3Service,
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

  @HandleError('Failed to register driver')
  async driverRegister(dto: DriverRegisterDto) {
    // 1. Normalize phone: remove leading '+' if present
    if (!dto.phone) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Phone is required');
    }

    dto.phone = dto.phone.trim();
    if (dto.phone.startsWith('+')) {
      dto.phone = dto.phone.slice(1);
    }

    // 2. Validate phone: digits only, length 7-15
    if (!/^\d{7,15}$/.test(dto.phone)) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Phone must be a valid number without + sign',
      );
    }

    // 3. Check if email already exists
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new AppError(HttpStatus.CONFLICT, 'Email already in use');
    }

    // 4. Check if phone already exists
    const existingDriver = await this.prisma.client.driver.findUnique({
      where: { phone: dto.phone },
    });
    if (existingDriver) {
      throw new AppError(HttpStatus.CONFLICT, 'Phone number already in use');
    }

    // 5. Hash password
    const hashedPassword = await this.utils.hash(dto.password);

    // 6. Upload required files to S3
    const uploadFile = async (
      file: Express.Multer.File,
      fieldName: string,
    ): Promise<FileInstance> => {
      if (!file) {
        throw new AppError(HttpStatus.BAD_REQUEST, `${fieldName} is required`);
      }
      return this.s3.uploadFile(file);
    };

    const [driverLicense, vehicleRegistration, transportCertificate] =
      await Promise.all([
        uploadFile(dto.driverLicense, 'driverLicense'),
        uploadFile(dto.vehicleRegistration, 'vehicleRegistration'),
        uploadFile(dto.transportCertificate, 'transportCertificate'),
      ]);

    // 7. Create User + Driver in a transaction
    const result = await this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          name: dto.name,
          role: 'DRIVER',
        },
      });

      const driver = await tx.driver.create({
        data: {
          userId: user.id,
          phone: dto.phone,
          state: dto.state,
          address: dto.address,
          vehicleType: dto.vehicleType,
          vehicleCapacity: dto.vehicleCapacity,
          yearsOfExperience: dto.yearsOfExperience,
          previousExperience: dto.previousExperience,
          driverLicenseId: driverLicense.id,
          driverLicenseUrl: driverLicense.url,
          vehicleRegistrationId: vehicleRegistration.id,
          vehicleRegistrationUrl: vehicleRegistration.url,
          transportCertificateId: transportCertificate.id,
          transportCertificateUrl: transportCertificate.url,
        },
      });

      return { user, driver };
    });

    // 8. Sanitize user before returning
    const sanitizedUser = await this.utils.sanitizeUser(result.user);

    return successResponse(
      { driver: result.driver, user: sanitizedUser },
      'Driver registered successfully',
    );
  }
}
