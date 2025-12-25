import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HandleWebhookService } from '../services/handle-webhook.service';

@ApiTags('Webhook Payment')
@Controller('webhook')
export class SubscriptionController {
  constructor(private readonly handleWebhookService: HandleWebhookService) {}

  @ApiOperation({ summary: 'Handle Stripe webhook events (Public Endpoint)' })
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Body() body: Buffer, // raw body for Stripe verification
  ) {
    try {
      await this.handleWebhookService.handleWebhook(signature, body);
      return { received: true };
    } catch (error) {
      return { received: false, error: error.message };
    }
  }
}
