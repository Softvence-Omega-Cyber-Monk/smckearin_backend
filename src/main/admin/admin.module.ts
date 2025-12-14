import { Module } from '@nestjs/common';
import { AdminTeamController } from './controllers/admin-team.controller';
import { AdminTeamService } from './services/admin-team.service';

@Module({
  controllers: [AdminTeamController],
  providers: [AdminTeamService],
})
export class AdminModule {}
