import { GetUser, ValidateDriver } from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOnboardingLinkDto } from '../dto/driver-payment.dto';
import { GetTransactionDto } from '../dto/get-transaction.dto';
import { DriverPaymentService } from '../services/driver-payment.service';
import { GetSingleTransactionService } from '../services/get-single-transaction.service';

@ApiTags('Driver Payment')
@ApiBearerAuth()
@ValidateDriver()
@Controller('driver-payment')
export class DriverPaymentController {
  constructor(
    private readonly driverPaymentService: DriverPaymentService,
    private readonly getSingleTransactionService: GetSingleTransactionService,
  ) { }

  @Get('payout-status')
  async getPayoutStatus(@GetUser('sub') userId: string) {
    return await this.driverPaymentService.getPayoutStatus(userId);
  }

  @ApiOperation({ summary: 'Create Stripe onboarding link' })
  @Post('onboarding-link')
  async createOnboardingLink(
    @GetUser('sub') userId: string,
    @Body() dto: CreateOnboardingLinkDto,
  ) {
    return await this.driverPaymentService.createOnboardingLink(userId, dto);
  }

  @Post('login-link')
  async getLoginLink(@GetUser('sub') userId: string) {
    return await this.driverPaymentService.getLoginLink(userId);
  }

  @ApiOperation({ summary: 'Get driver transaction history' })
  @Get('history')
  async getHistory(
    @GetUser('sub') userId: string,
    @Query() dto: GetTransactionDto,
  ) {
    return await this.driverPaymentService.getTransactionHistory(userId, dto);
  }

  @ApiOperation({ summary: 'Get driver payment statistics' })
  @Get('stats')
  async getStats(@GetUser('sub') userId: string) {
    return await this.driverPaymentService.getDriverStats(userId);
  }

  @ApiOperation({ summary: 'Get single transaction details' })
  @Get('transactions/:transactionId')
  async getTransaction(
    @Param('transactionId') transactionId: string,
    @GetUser() user: JWTPayload,
  ) {
    return this.getSingleTransactionService.getTransaction(transactionId, user);
  }
}
