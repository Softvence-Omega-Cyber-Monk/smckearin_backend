import { Module } from '@nestjs/common';
import { TransportController } from './controllers/transport.controller';
import { CreateTransportService } from './services/create-transport.service';

@Module({
  controllers: [TransportController],
  providers: [CreateTransportService],
})
export class TransportModule {}
