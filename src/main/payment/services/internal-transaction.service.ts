import { AppError } from '@/core/error/handle-error.app';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TransactionStatus } from '@prisma';

@Injectable()
export class InternalTransactionService {
  private readonly logger = new Logger(InternalTransactionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async initializeTransaction(transportId: string, amount: number) {
    const transport = this.prisma.client.transport.findUnique({
      where: { id: transportId },
    });

    if (!transport) {
      this.logger.error(`Transport ${transportId} not found`);
      throw new AppError(
        HttpStatus.NOT_FOUND,
        `Transport ${transportId} not found`,
      );
    }

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

  async updateStripeDetails(params: {
    transportId: string;
    stripePaymentIntentId?: string;
    stripeTransferId?: string;
    status?: TransactionStatus;
  }) {
    const transport = await this.prisma.client.transport.findUnique({
      where: { id: params.transportId },
    });

    if (!transport) {
      this.logger.error(`Transport ${params.transportId} not found`);
      throw new AppError(
        HttpStatus.NOT_FOUND,
        `Transport ${params.transportId} not found`,
      );
    }

    return this.prisma.client.transaction.update({
      where: { transportId: params.transportId },
      data: {
        stripePaymentIntentId: params.stripePaymentIntentId,
        stripeTransferId: params.stripeTransferId,
        status: params.status,
      },
    });
  }

  async finalizeTransaction(transportId: string, status: TransactionStatus) {
    const transport = await this.prisma.client.transport.findUnique({
      where: { id: transportId },
    });

    if (!transport) {
      this.logger.error(`Transport ${transportId} not found`);
      throw new AppError(
        HttpStatus.NOT_FOUND,
        `Transport ${transportId} not found`,
      );
    }

    return this.prisma.client.transaction.update({
      where: { transportId },
      data: { status },
    });
  }
}
