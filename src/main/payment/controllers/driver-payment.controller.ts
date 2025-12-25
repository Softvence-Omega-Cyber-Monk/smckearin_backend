import { successResponse } from '@/common/utils/response.util';
import { GetUser, ValidateDriver } from '@/core/jwt/jwt.decorator';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOnboardingLinkDto } from '../dto/driver-payment.dto';
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
    const result = await this.driverPaymentService.createOnboardingLink(
      userId,
      dto,
    );
    return successResponse(result, 'Onboarding link created successfully');
  }

  @ApiOperation({ summary: 'Get Stripe Express dashboard login link' })
  @Post('login-link')
  async getLoginLink(@GetUser('sub') userId: string) {
    const result = await this.driverPaymentService.getLoginLink(userId);
    return successResponse(result, 'Login link created successfully');
  }

  @ApiOperation({ summary: 'Get driver transaction history' })
  @Get('history')
  async getHistory(@GetUser('sub') userId: string) {
    const result =
      await this.driverPaymentService.getTransactionHistory(userId);
    return successResponse(
      result,
      'Transaction history retrieved successfully',
    );
  }
}
