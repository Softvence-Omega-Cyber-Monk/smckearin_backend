import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CreateMappingTemplateDto,
  UpdateMappingTemplateDto,
} from '../dto/imports.dto';

@Injectable()
export class MappingTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error creating mapping template')
  async createTemplate(dto: CreateMappingTemplateDto) {
    const template = await this.prisma.client.importMapping.create({
      data: {
        name: dto.name,
        description: dto.description,
        shelterId: dto.shelterId,
        fieldMapping: dto.fieldMapping,
        transformations: dto.transformations || {},
        isActive: dto.isActive ?? true,
      },
    });

    return successResponse(template, 'Mapping template created successfully');
  }

  @HandleError('Error fetching mapping templates')
  async getTemplates(shelterId: string) {
    const templates = await this.prisma.client.importMapping.findMany({
      where: { shelterId },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(templates, 'Mapping templates fetched successfully');
  }

  @HandleError('Error fetching mapping template')
  async getTemplate(id: string, shelterId: string) {
    const template = await this.prisma.client.importMapping.findUnique({
      where: { id },
    });

    if (!template) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Mapping template not found');
    }

    if (template.shelterId !== shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'You do not have access to this template',
      );
    }

    return successResponse(template, 'Mapping template fetched successfully');
  }

  @HandleError('Error updating mapping template')
  async updateTemplate(
    id: string,
    shelterId: string,
    dto: UpdateMappingTemplateDto,
  ) {
    const template = await this.prisma.client.importMapping.findUnique({
      where: { id },
    });

    if (!template) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Mapping template not found');
    }

    if (template.shelterId !== shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'You do not have access to this template',
      );
    }

    const updated = await this.prisma.client.importMapping.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        fieldMapping: dto.fieldMapping,
        transformations: dto.transformations,
        isActive: dto.isActive,
      },
    });

    return successResponse(updated, 'Mapping template updated successfully');
  }

  @HandleError('Error deleting mapping template')
  async deleteTemplate(id: string, shelterId: string) {
    const template = await this.prisma.client.importMapping.findUnique({
      where: { id },
    });

    if (!template) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Mapping template not found');
    }

    if (template.shelterId !== shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'You do not have access to this template',
      );
    }

    await this.prisma.client.importMapping.delete({
      where: { id },
    });

    return successResponse(null, 'Mapping template deleted successfully');
  }
}
