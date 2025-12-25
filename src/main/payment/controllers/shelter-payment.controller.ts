import { GetUser, ValidateManager } from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetTransactionDto } from '../dto/get-transaction.dto';
import { GetSingleTransactionService } from '../services/get-single-transaction.service';
import { ShelterPaymentService } from '../services/shelter-payment.service';

@ApiTags('Shelter Payment')
@ApiBearerAuth()
@ValidateManager()
@Controller('shelter-payment')
export class ShelterPaymentController {
  constructor(
    private readonly shelterPaymentService: ShelterPaymentService,
    private readonly getSingleTransactionService: GetSingleTransactionService,
  ) {}

  @ApiOperation({ summary: 'Create Stripe SetupIntent to add a card' })
  @Post('setup-intent')
  async createSetupIntent(@GetUser('sub') userId: string) {
    return await this.shelterPaymentService.createSetupIntent(userId);
  }

  @ApiOperation({ summary: 'List saved payment method' })
  @Get('payment-method')
  async listPaymentMethods(@GetUser('sub') userId: string) {
    return await this.shelterPaymentService.listPaymentMethods(userId);
  }

  @ApiOperation({ summary: 'Remove saved payment method' })
  @Get('payment-method/remove')
  async removePaymentMethod(@GetUser('sub') userId: string) {
    return await this.shelterPaymentService.removePaymentMethod(userId);
  }

  @ApiOperation({ summary: 'Get shelter transaction history' })
  @Get('history')
  async getHistory(
    @GetUser('sub') userId: string,
    @Query() dto: GetTransactionDto,
  ) {
    return await this.shelterPaymentService.getTransactionHistory(userId, dto);
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
