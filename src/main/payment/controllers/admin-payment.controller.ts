import { GetUser, ValidateAdmin } from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ComplexityTypeDto,
  UpdateComplexityFeeDto,
  UpdatePaymentSettingsDto,
  UpdatePricingRuleDto,
} from '../dto/admin-payment.dto';
import { GetTransactionDto } from '../dto/get-transaction.dto';
import { AdminPaymentService } from '../services/admin-payment.service';
import { GetSingleTransactionService } from '../services/get-single-transaction.service';
import { PayoutService } from '../services/payout.service';

@ApiTags('Admin Payment')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('admin-payment')
export class AdminPaymentController {
  constructor(
    private readonly adminPaymentService: AdminPaymentService,
    private readonly getSingleTransactionService: GetSingleTransactionService,
    private readonly payoutService: PayoutService,
  ) {}

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

  @Get('transactions/:transactionId')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  async getTransaction(
    @Param('transactionId') transactionId: string,
    @GetUser() user: JWTPayload,
  ) {
    return this.getSingleTransactionService.getTransaction(transactionId, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get payment statistics' })
  async getPaymentStats() {
    return this.adminPaymentService.getPaymentStats();
  }

  @Patch('transactions/:transactionId/hold')
  @ApiOperation({ summary: 'Toggle a transaction on hold' })
  async toggleHoldTransaction(@Param('transactionId') transactionId: string) {
    return this.adminPaymentService.toggleHoldTransaction(transactionId);
  }

  @Post('settlement')
  @ApiOperation({ summary: 'Trigger a settlement' })
  async triggerSettlement() {
    return this.payoutService.triggerSettlement();
  }
}
