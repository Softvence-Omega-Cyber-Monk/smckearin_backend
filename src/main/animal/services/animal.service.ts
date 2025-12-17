import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { FileInstance } from '@prisma';
import { CreateAnimalDto } from '../dto/create-animal.dto';

@Injectable()
export class AnimalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @HandleError('Error creating animal')
  async createAnimal(
    userId: string,
    dto: CreateAnimalDto,
    file?: Express.Multer.File,
  ) {
    // Fetch user and associated shelter
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;

    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    // Handle file upload
    let fileInstance: FileInstance | undefined;
    let imageUrl: string | undefined;
    if (file) {
      fileInstance = await this.s3.uploadFile(file);
      imageUrl = fileInstance.url;
    }

    // Create the animal
    const animal = await this.prisma.client.animal.create({
      data: {
        name: dto.name,
        breed: dto.breed,
        species: dto.species,
        gender: dto.gender,
        age: dto.age ?? 0,
        weight: dto.weight ?? 0,
        color: dto.color ?? null,
        specialNeeds: dto.specialNeeds ?? null,
        medicalNotes: dto.medicalNotes ?? null,
        behaviorNotes: dto.behaviorNotes ?? null,

        shelterId,

        // File association
        imageId: fileInstance?.id ?? null,
        imageUrl: imageUrl ?? null,
      },
    });

    return successResponse(animal, 'Animal created successfully');
  }
}
