import { GetUser, ValidateManager } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateAnimalDto } from '../dto/create-animal.dto';
import { AnimalService } from '../services/animal.service';

@ApiTags('Animal')
@ApiBearerAuth()
@ValidateManager()
@Controller('animal')
export class AnimalController {
  constructor(private readonly animalService: AnimalService) {}

  @ApiOperation({ summary: 'Create animal (manager only)' })
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async createAnimal(
    @GetUser('sub') userId: string,
    @Body() dto: CreateAnimalDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.animalService.createAnimal(userId, dto, file);
  }

  @ApiOperation({ summary: 'Update animal (manager only)' })
  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async updateAnimal(
    @GetUser('sub') userId: string,
    @Param('id') animalId: string,
    @Body() dto: CreateAnimalDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.animalService.updateAnimal(userId, animalId, dto, file);
  }
}
