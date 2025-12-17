import { Module } from '@nestjs/common';
import { AnimalController } from './controllers/animal.controller';
import { AnimalService } from './services/animal.service';

@Module({
  controllers: [AnimalController],
  providers: [AnimalService],
  exports: [],
})
export class AnimalModule {}
