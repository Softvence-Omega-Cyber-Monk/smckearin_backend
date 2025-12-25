import { GetUser, ValidateDriver } from '@/core/jwt/jwt.decorator';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOnboardingLinkDto } from '../dto/driver-payment.dto';
import { GetTransactionDto } from '../dto/get-transaction.dto';
import { DriverPaymentService } from '../services/driver-payment.service';

@ApiTags('Driver Payment')
@ApiBearerAuth()
@ValidateDriver()
@Controller('driver-payment')
export class DriverPaymentController {
  constructor(private readonly driverPaymentService: DriverPaymentService) {}

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
    return await this.driverPaymentService.getTransactionHistory(userId);
  }
}
