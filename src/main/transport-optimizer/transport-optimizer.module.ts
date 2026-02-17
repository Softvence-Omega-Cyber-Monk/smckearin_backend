import { Module } from '@nestjs/common';
import { TransportOptimizerController } from './controllers/transport-optimizer.controller';
import { BatchOptimizationService } from './services/batch-optimization.service';
import { IlpSolverService } from './services/ilp-solver.service';

@Module({
  controllers: [TransportOptimizerController],
  providers: [IlpSolverService, BatchOptimizationService],
  exports: [BatchOptimizationService],
})
export class TransportOptimizerModule {}
