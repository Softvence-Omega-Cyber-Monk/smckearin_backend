import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { TransactionStatus } from '@prisma';

@Injectable()
export class InternalTransactionService {
  private readonly logger = new Logger(InternalTransactionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initializes a transaction record for a transport.
   * This is used for internal auditing and tracking of Stripe IDs.
   */
  async initializeTransaction(transportId: string, amount: number) {
    const existing = await this.prisma.client.transaction.findUnique({
      where: { transportId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.client.transaction.create({
      data: {
        transportId,
        amount,
        currency: 'usd',
        status: 'PENDING',
      },
    });
  }

  /**
   * Updates a transaction with Stripe IDs after successful processing.
   */
  async updateStripeDetails(params: {
    transportId: string;
    stripePaymentIntentId?: string;
    stripeTransferId?: string;
    status?: TransactionStatus;
  }) {
    return this.prisma.client.transaction.update({
      where: { transportId: params.transportId },
      data: {
        stripePaymentIntentId: params.stripePaymentIntentId,
        stripeTransferId: params.stripeTransferId,
        status: params.status,
      },
    });
  }

  /**
   * Finalizes the transaction status.
   */
  async finalizeTransaction(transportId: string, status: TransactionStatus) {
    return this.prisma.client.transaction.update({
      where: { transportId },
      data: { status },
    });
  }
}
