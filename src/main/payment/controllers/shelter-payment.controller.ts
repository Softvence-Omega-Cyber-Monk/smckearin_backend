import { GetUser, ValidateManager } from '@/core/jwt/jwt.decorator';
import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetTransactionDto } from '../dto/get-transaction.dto';
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
    return await this.shelterPaymentService.createSetupIntent(userId);
  }

  @ApiOperation({ summary: 'List saved payment methods' })
  @Get('payment-methods')
  async listPaymentMethods(@GetUser('sub') userId: string) {
    return await this.shelterPaymentService.listPaymentMethods(userId);
  }

  @ApiOperation({ summary: 'Get shelter transaction history' })
  @Get('history')
  async getHistory(
    @GetUser('sub') userId: string,
    @Query() dto: GetTransactionDto,
  ) {
    return await this.shelterPaymentService.getTransactionHistory(userId, dto);
  }
}
