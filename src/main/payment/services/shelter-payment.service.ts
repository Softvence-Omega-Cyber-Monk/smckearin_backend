import { AppError } from '@/core/error/handle-error.app';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { StripeService } from '@/lib/stripe/stripe.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InternalTransactionService } from './internal-transaction.service';

@Injectable()
export class ShelterPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly transactionService: InternalTransactionService,
  ) {}

  /**
   * Creates a SetupIntent for the shelter to add a payment method (card).
   */
  async createSetupIntent(userId: string) {
    // Shelter doesn't have direct userId connection usually, it's via admins/managers
    const shelter = await this.prisma.client.shelter.findFirst({
      where: {
        OR: [
          { shelterAdmins: { some: { id: userId } } },
          { managers: { some: { id: userId } } },
        ],
      },
    });

    if (!shelter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Shelter profile not found');
    }

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // Creates setup intent, which creates customer if needed in StripeService
    const setupIntent = await this.stripeService.createSetupIntent({
      email: user.email,
      name: shelter.name,
      userId: user.id,
      type: 'transport_payment', // Use a valid type from Metadata
    });

    // If shelter doesn't have stripeCustomerId, update it
    if (!shelter.stripeCustomerId && setupIntent.customer) {
      await this.prisma.client.shelter.update({
        where: { id: shelter.id },
        data: { stripeCustomerId: setupIntent.customer as string },
      });
    }

    return {
      clientSecret: setupIntent.client_secret,
      customerId: setupIntent.customer,
    };
  }

  /**
   * Lists saved payment methods for the shelter.
   */
  async listPaymentMethods(userId: string) {
    const shelter = await this.prisma.client.shelter.findFirst({
      where: {
        OR: [
          { shelterAdmins: { some: { id: userId } } },
          { managers: { some: { id: userId } } },
        ],
      },
    });

    if (!shelter || !shelter.stripeCustomerId) {
      return { hasPaymentMethod: false };
    }

    const customer = (await this.stripeService.retrieveCustomer(
      shelter.stripeCustomerId,
    )) as any;

    // Check default source or invoice settings
    const hasPaymentMethod =
      !!customer.default_source ||
      !!customer.invoice_settings?.default_payment_method;

    return {
      hasPaymentMethod,
    };
  }

  /**
   * Fetches transaction history for the shelter.
   */
  async getTransactionHistory(userId: string) {
    const shelter = await this.prisma.client.shelter.findFirst({
      where: {
        OR: [
          { shelterAdmins: { some: { id: userId } } },
          { managers: { some: { id: userId } } },
        ],
      },
    });

    if (!shelter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');
    }

    // Find all transports by this shelter
    const transports = await this.prisma.client.transport.findMany({
      where: { shelterId: shelter.id },
      select: { id: true },
    });

    const transportIds = transports.map((t) => t.id);

    if (transportIds.length === 0) {
      return [];
    }

    const transactions = await this.prisma.client.transaction.findMany({
      where: { transportId: { in: transportIds } },
      include: {
        transport: {
          select: {
            pickUpLocation: true,
            dropOffLocation: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions;
  }
}
