import { successResponse } from '@/common/utils/response.util';
import { GetUser, ValidateManager } from '@/core/jwt/jwt.decorator';
import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShelterPaymentService } from '../services/shelter-payment.service';

@ApiTags('Shelter Payment')
@ApiBearerAuth()
@ValidateManager()
@Controller('shelter-payment')
export class ShelterPaymentController {
  constructor(private readonly shelterPaymentService: ShelterPaymentService) {}

  @ApiOperation({ summary: 'Create Stripe SetupIntent to add a card' })
  @Post('setup-intent')
  async createSetupIntent(@GetUser('sub') userId: string) {
    const result = await this.shelterPaymentService.createSetupIntent(userId);
    return successResponse(result, 'Setup intent created successfully');
  }

  @ApiOperation({ summary: 'List saved payment methods' })
  @Get('payment-methods')
  async listPaymentMethods(@GetUser('sub') userId: string) {
    const result = await this.shelterPaymentService.listPaymentMethods(userId);
    return successResponse(result, 'Payment methods status retrieved');
  }

  @ApiOperation({ summary: 'Get shelter transaction history' })
  @Get('history')
  async getHistory(@GetUser('sub') userId: string) {
    const result =
      await this.shelterPaymentService.getTransactionHistory(userId);
    return successResponse(
      result,
      'Transaction history retrieved successfully',
    );
  }
}
