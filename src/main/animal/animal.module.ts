import { Module } from '@nestjs/common';
import { AnimalController } from './controllers/animal.controller';
import { AnimalService } from './services/animal.service';
import { GetAnimalsService } from './services/get-animals.service';

@Module({
  controllers: [AnimalController],
  providers: [AnimalService, GetAnimalsService],
  exports: [],
})
export class AnimalModule {}
