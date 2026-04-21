import { generateUniqueAnimalSid } from '@/common/utils/animal-id.util';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { FileInstance, Prisma } from '@prisma';
import { CreateAnimalDto, UpdateAnimalDto } from '../dto/create-animal.dto';

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
    if (file) {
      fileInstance = await this.s3.uploadFile(file);
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

        sid: dto.sid
          ? await this.validateAndGetSid(dto.sid)
          : await generateUniqueAnimalSid(this.prisma.client),

        // File association
        imageId: fileInstance?.id ?? null,
        imageUrl: fileInstance?.url ?? null,
      },
    });

    return successResponse(animal, 'Animal created successfully');
  }

  private async validateAndGetSid(sid: string, currentAnimalId?: string) {
    const trimmedSid = sid.trim();
    if (!trimmedSid) return generateUniqueAnimalSid(this.prisma.client);

    const exists = await this.prisma.client.animal.findFirst({
      where: {
        sid: trimmedSid,
        NOT: currentAnimalId ? { id: currentAnimalId } : undefined,
      },
      select: { id: true },
    });

    if (exists) {
      throw new AppError(
        HttpStatus.CONFLICT,
        `Animal ID "${trimmedSid}" is already in use`,
      );
    }

    return trimmedSid;
  }

  @HandleError('Error updating animal')
  async updateAnimal(
    userId: string,
    animalId: string,
    dto: UpdateAnimalDto,
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

    // Fetch the animal to ensure it exists and belongs to user's shelter
    const oldAnimal = await this.prisma.client.animal.findUniqueOrThrow({
      where: { id: animalId },
      select: {
        id: true,
        shelterId: true,
        imageId: true,
        sid: true,
      },
    });

    if (oldAnimal.shelterId !== shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'You do not have permission to update this animal',
      );
    }

    // Handle file upload
    let fileInstance: FileInstance | undefined;
    if (file) {
      fileInstance = await this.s3.uploadFile(file);
    }

    // Prepare selective update data
    const updateData: Prisma.AnimalUpdateInput = {};

    if (dto.name?.trim()) updateData.name = dto.name.trim();
    if (dto.breed?.trim()) updateData.breed = dto.breed.trim();
    if (dto.species) updateData.species = dto.species;
    if (dto.gender) updateData.gender = dto.gender;
    if (dto.age !== undefined) updateData.age = dto.age;
    if (dto.weight !== undefined) updateData.weight = dto.weight;
    if (dto.color?.trim()) updateData.color = dto.color.trim();
    if (dto.specialNeeds?.trim())
      updateData.specialNeeds = dto.specialNeeds.trim();
    if (dto.medicalNotes?.trim())
      updateData.medicalNotes = dto.medicalNotes.trim();
    if (dto.behaviorNotes?.trim())
      updateData.behaviorNotes = dto.behaviorNotes.trim();

    if (dto.sid) {
      updateData.sid = await this.validateAndGetSid(dto.sid, animalId);
    }

    if (fileInstance) {
      updateData.image = { connect: { id: fileInstance.id } };
      updateData.imageUrl = fileInstance.url;
    }

    // Update the animal
    const updatedAnimal = await this.prisma.client.animal.update({
      where: { id: animalId },
      data: updateData,
      include: { image: true, shelter: true, bondedWith: true },
    });

    // Cleanup old image only after successful DB update
    if (fileInstance && oldAnimal.imageId) {
      try {
        await this.s3.deleteFile(oldAnimal.imageId);
      } catch (err) {
        console.error(`Failed to delete old image ${oldAnimal.imageId}:`, err);
      }
    }

    return successResponse(updatedAnimal, 'Animal updated successfully');
  }

  @HandleError('Error deleting animal')
  async deleteAnimal(userId: string, animalId: string) {
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

    // Fetch the animal to ensure it exists and belongs to user's shelter
    const animal = await this.prisma.client.animal.findUniqueOrThrow({
      where: { id: animalId },
      select: {
        id: true,
        shelterId: true,
        imageId: true,
      },
    });

    if (animal.shelterId !== shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'You do not have permission to delete this animal',
      );
    }

    // Delete the animal
    await this.prisma.client.animal.delete({
      where: { id: animalId },
    });

    if (animal.imageId) {
      try {
        await this.s3.deleteFile(animal.imageId);
      } catch (err) {
        console.error(
          `Failed to delete image ${animal.imageId} after animal deletion:`,
          err,
        );
      }
    }

    return successResponse(null, 'Animal deleted successfully');
  }
}
