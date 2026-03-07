import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { StripeService } from '@/lib/stripe/stripe.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthDeleteAccountService {
  private readonly logger = new Logger(AuthDeleteAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  @HandleError('Failed to delete account')
  async deleteAccount(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: {
        drivers: true,
        shelterAdminOf: true,
      },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    this.logger.log(
      `Performing Hard Core Delete for user ${userId} (${user.email})`,
    );

    // 1. Cleanup Stripe Driver Account (Express)
    if (user.drivers?.stripeAccountId) {
      try {
        await this.stripe.deleteAccount(user.drivers.stripeAccountId);
      } catch (error) {
        this.logger.error(
          `Failed to delete Stripe Express account ${user.drivers.stripeAccountId} for user ${userId}`,
          error,
        );
        // Continue anyway to ensure the user record is deleted
      }
    }

    // 2. Cleanup Stripe Shelter Customer
    // If the user is the admin of a shelter, we check if they are the only admin.
    if (user.shelterAdminOf?.stripeCustomerId) {
      const otherAdminsCount = await this.prisma.client.user.count({
        where: {
          shelterAdminOfId: user.shelterAdminOf.id,
          id: { not: userId },
        },
      });

      // If this is the last admin, we might want to delete the Stripe customer.
      // However, for "Hard Core" delete of the USER account, we should at least
      // ensure we don't leave orphaned Stripe data if the shelter itself were to be deleted.
      // But Shelter deletion is a separate concern.
      // For now, we only delete the Stripe Customer if the user is a SHELTER_ADMIN
      // and we want to actually nuke the shelter too.
      // If the shelter remains (e.g. other admins exist), we don't delete the Stripe customer.

      if (otherAdminsCount === 0) {
        try {
          await this.stripe.deleteCustomer(
            user.shelterAdminOf.stripeCustomerId,
          );
        } catch (error) {
          this.logger.error(
            `Failed to delete Stripe customer ${user.shelterAdminOf.stripeCustomerId} for shelter ${user.shelterAdminOf.id}`,
            error,
          );
        }
      }
    }

    // 3. Delete the User record
    // Prisma cascade handles related records (Driver, Vet, RefreshToken, etc.)
    await this.prisma.client.user.delete({
      where: { id: userId },
    });

    return successResponse(null, 'Account permanently deleted');
  }
}
