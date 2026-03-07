import { Module } from '@nestjs/common';
import { OperationsController } from './controllers/operations.controller';
import { OperationsService } from './services/operations.service';

@Module({
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
