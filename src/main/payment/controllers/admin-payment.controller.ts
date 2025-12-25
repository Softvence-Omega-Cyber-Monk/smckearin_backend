import { ValidateAdmin } from '@/core/jwt/jwt.decorator';
import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ComplexityTypeDto,
  UpdateComplexityFeeDto,
  UpdatePaymentSettingsDto,
  UpdatePricingRuleDto,
} from '../dto/admin-payment.dto';
import { GetTransactionDto } from '../dto/get-transaction.dto';
import { AdminPaymentService } from '../services/admin-payment.service';

@ApiTags('Admin Payment')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('admin-payment')
export class AdminPaymentController {
  constructor(private readonly adminPaymentService: AdminPaymentService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get global payment feature flags' })
  async getSettings() {
    return this.adminPaymentService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update global payment feature flags' })
  async updateSettings(@Body() dto: UpdatePaymentSettingsDto) {
    return this.adminPaymentService.updateSettings(dto);
  }

  @Get('pricing-rules/current')
  @ApiOperation({ summary: 'Get current active pricing rules' })
  async getCurrentPricingRule() {
    return this.adminPaymentService.getCurrentPricingRule();
  }

  @Post('pricing-rules')
  @ApiOperation({ summary: 'Create a new version of pricing rules' })
  async createPricingRule(@Body() dto: UpdatePricingRuleDto) {
    return this.adminPaymentService.createPricingRule(dto);
  }

  @Get('complexity-fees')
  @ApiOperation({ summary: 'Get all animal complexity fees' })
  async getComplexityFees() {
    return this.adminPaymentService.getComplexityFees();
  }

  @Patch('complexity-fees')
  @ApiOperation({ summary: 'Update a specific complexity fee' })
  async updateComplexityFee(
    @Query() query: ComplexityTypeDto,
    @Body() dto: UpdateComplexityFeeDto,
  ) {
    return this.adminPaymentService.updateComplexityFee(query.type, dto);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get all transactions' })
  async getTransactions(@Query() dto: GetTransactionDto) {
    return this.adminPaymentService.getTransactions(dto);
  }
}
