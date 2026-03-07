import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OptimizeBatchDto } from '../dto/transport-optimizer.dto';
import { BatchOptimizationService } from '../services/batch-optimization.service';

@Controller('transport-optimizer')
export class TransportOptimizerController {
  constructor(
    private readonly batchOptimizationService: BatchOptimizationService,
  ) {}

  @Post('optimize')
  async optimizeBatch(@Body() dto: OptimizeBatchDto) {
    const result = await this.batchOptimizationService.optimizeBatch(dto);
    return {
      success: true,
      message: 'Batch optimized successfully',
      data: result,
    };
  }

  @Get('batches')
  async getBatches(@Query('shelterId') shelterId?: string) {
    return await this.batchOptimizationService.getBatches(shelterId);
  }

  @Get('batches/:id')
  async getBatch(@Param('id') batchId: string) {
    return await this.batchOptimizationService.getBatch(batchId);
  }

  @Post('batches/:id/execute')
  async executeBatch(@Param('id') batchId: string) {
    return await this.batchOptimizationService.executeBatch(batchId);
  }
}
