import { GetUser, ValidateManager } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { GetAnimalDto, GetPendingAnimalDto } from '../dto/get-animal.dto';
import { AnimalService } from '../services/animal.service';
import { GetAnimalsService } from '../services/get-animals.service';

@ApiTags('Animal')
@ApiBearerAuth()
@ValidateManager()
@Controller('animal')
export class AnimalController {
  constructor(
    private readonly animalService: AnimalService,
    private readonly getAnimalsService: GetAnimalsService,
  ) {}

  @ApiOperation({ summary: 'Create animal (shelter only)' })
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

  @ApiOperation({ summary: 'Update animal (shelter only)' })
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

  @ApiOperation({ summary: 'Delete animal (shelter only)' })
  @Patch(':id')
  async deleteAnimal(
    @GetUser('sub') userId: string,
    @Param('id') animalId: string,
  ) {
    return this.animalService.deleteAnimal(userId, animalId);
  }

  @ApiOperation({ summary: 'Get own shelter animals (shelter only)' })
  @Get()
  async getAnimals(@GetUser('sub') userId: string, @Query() dto: GetAnimalDto) {
    return this.getAnimalsService.getAnimals(userId, dto);
  }

  @ApiOperation({
    summary: 'Get animals that are available for transport (shelter only)',
  })
  @Get('at-shelter')
  async getPendingAnimals(
    @GetUser('sub') userId: string,
    @Query() dto: GetPendingAnimalDto,
  ) {
    return this.getAnimalsService.getPendingAnimals(userId, dto);
  }

  @ApiOperation({ summary: 'Get single animal (shelter only)' })
  @Get(':id')
  async getSingleAnimal(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.getAnimalsService.getSingleAnimal(userId, id);
  }
}
