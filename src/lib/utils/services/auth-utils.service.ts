import { UserResponseDto } from '@/common/dto/user-response.dto';
import { ENVEnum } from '@/common/enum/env.enum';
import { successResponse, TResponse } from '@/common/utils/response.util';
import { JWTPayload, TokenPair } from '@/core/jwt/jwt.interface';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FileInstance, OtpType, User } from '@prisma';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { randomBytes, randomInt } from 'crypto';

@Injectable()
export class AuthUtilsService {
  private saltRounds = 10;
  private refreshTokenDays = 30;
  private refreshTokenLength = 32;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async sanitizeUser<T = UserResponseDto>(
    user: User & { profilePicture?: FileInstance | null },
  ): Promise<T> {
    if (!user) return null as T;

    const profilePictureUrl =
      user?.profilePictureId && user?.profilePicture
        ? (user.profilePicture.url ?? null)
        : null;

    const flatData = {
      ...user,
      profilePictureId: user?.profilePictureId ?? null,
      profilePictureUrl,
    };

    return plainToInstance(UserResponseDto, flatData, {
      excludeExtraneousValues: true,
    }) as T;
  }

  generateToken(payload: JWTPayload): string {
    const token = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
      expiresIn: this.configService.getOrThrow(ENVEnum.JWT_EXPIRES_IN),
    });

    return token;
  }

  async generateTokenPairAndSave(payload: JWTPayload): Promise<TokenPair> {
    const accessToken = this.generateToken(payload);

    const refreshToken = randomBytes(
      Math.max(32, Math.floor(this.refreshTokenLength / 2)),
    ).toString('hex');

    const refreshTokenExpiresAt = new Date(
      Date.now() + this.refreshTokenDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.client.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.sub,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  verifyToken<T extends object = any>(token: string): T {
    const secret = this.configService.getOrThrow<string>(ENVEnum.JWT_SECRET);
    try {
      return this.jwtService.verify<T>(token, { secret });
    } catch (err) {
      console.error(err);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  decodeToken(token: string): any {
    return this.jwtService.decode(token);
  }

  async revokeRefreshToken(token: string) {
    await this.prisma.client.refreshToken.deleteMany({ where: { token } });
  }

  async revokeAllRefreshTokensForUser(userId: string) {
    await this.prisma.client.refreshToken.deleteMany({ where: { userId } });
  }

  async findRefreshToken(token: string) {
    return this.prisma.client.refreshToken.findUnique({ where: { token } });
  }

  generateOtpAndExpiry(minutes = 5): { otp: number; expiryTime: Date } {
    const otp = randomInt(1000, 10000);
    const expiryTime = new Date(Date.now() + minutes * 60 * 1000);
    return { otp, expiryTime };
  }

  async generateOTPAndSave(userId: string, type: OtpType) {
    const { otp, expiryTime } = this.generateOtpAndExpiry();
    const hashedOtp = await this.hash(otp.toString());
    await this.prisma.client.userOtp.create({
      data: {
        userId,
        code: hashedOtp,
        type,
        expiresAt: expiryTime,
      },
    });
    return otp;
  }

  async getSanitizedUserById(id: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id },
      include: { profilePicture: true },
    });

    return this.sanitizeUser<UserResponseDto>(user);
  }

  async getUserByEmail(email: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: { profilePicture: true },
    });

    if (!user) return null;

    return this.sanitizeUser<UserResponseDto>(user);
  }

  async hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.saltRounds);
  }

  async compare(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }

  async findUserBy(
    key: 'id' | 'email',
    value: string,
  ): Promise<TResponse<any>> {
    const where: any = {};
    where[key] = value;

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where,
      include: {
        drivers: {
          include: {
            driverLicense: true,
            vehicleRegistration: true,
            transportCertificate: true,
          },
        },
        veterinarians: true,
        shelterAdminOf: true,
        managerOf: true,
      },
    });

    const { drivers, veterinarians, shelterAdminOf, managerOf, ...mainUser } =
      user;
    const sanitizedUser = await this.sanitizeUser(mainUser);

    let roleData: any = null;
    let isApproved = true;

    switch (user.role) {
      case 'DRIVER':
        if (drivers) {
          const driverLicenseUrl = drivers.driverLicenseUrl ?? null;
          const vehicleRegistrationUrl = drivers.vehicleRegistrationUrl ?? null;
          const transportCertificateUrl =
            drivers.transportCertificateUrl ?? null;

          roleData = {
            driverId: drivers.id,
            phone: drivers.phone,
            state: drivers.state,
            address: drivers.address,
            vehicleType: drivers.vehicleType,
            vehicleCapacity: drivers.vehicleCapacity,
            yearsOfExperience: drivers.yearsOfExperience,
            previousExperience: drivers.previousExperience,
            startTime: drivers.startTime,
            endTime: drivers.endTime,
            workingDays: drivers.workingDays,
            needsDriverLicense: !driverLicenseUrl,
            driverLicense: {
              id: drivers.driverLicenseId ?? null,
              url: driverLicenseUrl,
              status: drivers.driverLicenseStatus,
              uploadedAt: drivers.driverLicense?.updatedAt,
              documentType: drivers.driverLicense?.mimeType,
            },
            needsVehicleRegistration: !vehicleRegistrationUrl,
            vehicleRegistration: {
              id: drivers.vehicleRegistrationId ?? null,
              url: vehicleRegistrationUrl,
              status: drivers.vehicleRegistrationStatus,
              uploadedAt: drivers.vehicleRegistration?.updatedAt,
              documentType: drivers.vehicleRegistration?.mimeType,
            },
            needsTransportCertificate: !transportCertificateUrl,
            transportCertificate: {
              id: drivers.transportCertificateId ?? null,
              url: transportCertificateUrl,
              status: drivers.transportCertificateStatus,
              uploadedAt: drivers.transportCertificate?.updatedAt,
              documentType: drivers.transportCertificate?.mimeType,
            },
            status: drivers.status,
          };
          isApproved = drivers.status === 'APPROVED';
        } else {
          isApproved = false;
        }
        break;

      case 'VETERINARIAN':
        if (veterinarians) {
          roleData = {
            vetId: veterinarians.id,
            phone: veterinarians.phone,
            license: veterinarians.license,
            description: veterinarians.description,
            startTime: veterinarians.startTime,
            endTime: veterinarians.endTime,
            workingDays: veterinarians.workingDays,
            status: veterinarians.status,
          };
          isApproved = veterinarians.status === 'APPROVED';
        } else {
          isApproved = false;
        }
        break;

      case 'SHELTER_ADMIN':
        if (shelterAdminOf) {
          roleData = {
            shelterId: shelterAdminOf.id,
            name: shelterAdminOf.name,
            address: shelterAdminOf.address,
            phone: shelterAdminOf.phone,
            description: shelterAdminOf.description,
            startTime: shelterAdminOf.startTime,
            endTime: shelterAdminOf.endTime,
            workingDays: shelterAdminOf.workingDays,
            status: shelterAdminOf.status,
          };
          isApproved = shelterAdminOf.status === 'APPROVED';
        } else {
          isApproved = false;
        }
        break;

      case 'MANAGER':
        if (managerOf) {
          roleData = {
            shelterId: managerOf.id,
            name: managerOf.name,
            address: managerOf.address,
            phone: managerOf.phone,
            description: managerOf.description,
            startTime: managerOf.startTime,
            endTime: managerOf.endTime,
            workingDays: managerOf.workingDays,
            status: managerOf.status,
          };
          isApproved = managerOf.status === 'APPROVED';
        } else {
          isApproved = false;
        }
        break;

      default:
        roleData = null;
        isApproved = true;
    }

    return successResponse(
      {
        ...sanitizedUser,
        roleData,
        isApproved,
      },
      'User profile fetched successfully',
    );
  }
}
