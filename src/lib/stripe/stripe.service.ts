import { ENVEnum } from '@/common/enum/env.enum';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Metadata } from './stripe.types';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.getOrThrow<string>(
      ENVEnum.STRIPE_SECRET_KEY,
    );
    this.stripe = new Stripe(secretKey);
  }

  // Customer Management
  async createCustomer({
    email,
    name,
    userId,
  }: {
    email: string;
    name: string;
    userId: string;
  }) {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
        email,
        name,
        createdAt: new Date().toISOString(),
      },
    });

    this.logger.log(`Created Stripe customer ${customer.id} for ${email}`);

    return customer;
  }

  async retrieveCustomer(customerId: string) {
    const customer = await this.stripe.customers.retrieve(customerId);

    this.logger.log(`Retrieved Stripe customer ${customer.id}`);

    return customer;
  }

  async getCustomerByEmail(email: string) {
    const customers = await this.stripe.customers.list({
      limit: 1,
      email,
    });

    if (customers.data.length === 0) {
      this.logger.log(`No Stripe customer found for email ${email}`);
      return null;
    }

    this.logger.log(
      `Found Stripe customer ${customers.data[0].id} for email ${email}`,
    );

    return customers.data[0];
  }

  // Payment Intent Management
  async retrievePaymentIntent(paymentIntentId: string) {
    const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    this.logger.log(`Retrieved PaymentIntent ${paymentIntentId}`);
    return pi;
  }

  async createPaymentIntent(metadata: Metadata) {
    const userId = metadata.userId;

    const customer = await this.stripe.customers.list({
      email: metadata.email,
    });

    let customerId: string;

    if (customer.data.length > 0) {
      customerId = customer.data[0].id;
      this.logger.log(
        `Found existing Stripe customer ${customerId} for user ${userId}`,
      );
    } else {
      const newCustomer = await this.createCustomer({
        email: metadata.email,
        name: metadata.name,
        userId,
      });
      customerId = newCustomer.id;
    }

    const intent = await this.stripe.paymentIntents.create(
      {
        amount: metadata.priceCents,
        currency: 'usd',
        customer: customerId,
        receipt_email: metadata.email,
        automatic_payment_methods: { enabled: true },
        metadata,
        setup_future_usage: 'off_session',
      },
      {
        idempotencyKey: `pi_${metadata.userId}_${metadata.planId}`,
      },
    );

    this.logger.log(`Created payment intent ${intent.id}`);
    return intent;
  }

  // Setup Intent Management
  async retrieveSetupIntent(setupIntentId: string) {
    const setupIntent = await this.stripe.setupIntents.retrieve(setupIntentId);
    this.logger.log(`Retrieved SetupIntent ${setupIntentId}`);
    return setupIntent;
  }

  async createSetupIntent(metadata: Metadata) {
    try {
      // 1) find or create customer
      const existing = await this.stripe.customers.list({
        email: metadata.email,
        limit: 1,
      });
      let customerId: string;

      if (existing.data && existing.data.length > 0) {
        customerId = existing.data[0].id;
        this.logger.log(
          `Found existing Stripe customer ${customerId} for user ${metadata.userId}`,
        );
      } else {
        const newCustomer = await this.createCustomer({
          email: metadata.email,
          name: metadata.name,
          userId: metadata.userId,
        });
        customerId = newCustomer.id;
        this.logger.log(
          `Created new Stripe customer ${customerId} for user ${metadata.userId}`,
        );
      }

      // 2) create SetupIntent (no charge — collects & attaches payment method for future use)
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session', // important for subscriptions / future off-session charges
        metadata: {
          ...metadata,
          customerId,
        },
      });

      this.logger?.log(
        `Created SetupIntent ${setupIntent.id} for customer ${customerId}`,
      );
      return setupIntent; // contains id and client_secret
    } catch (err) {
      this.logger?.error(
        'createSetupIntent failed',
        (err as any)?.message ?? err,
      );
      throw err; // bubble up to caller so your HandleError decorator / logger handles it
    }
  }

  // Subscription Management
  async retrieveSubscription(subscriptionId: string) {
    const subscription =
      await this.stripe.subscriptions.retrieve(subscriptionId);

    this.logger.log(`Retrieved Stripe subscription ${subscription.id}`);

    return subscription;
  }

  async cancelSubscription(subscriptionId: string) {
    const subscription =
      await this.stripe.subscriptions.retrieve(subscriptionId);

    await this.stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    this.logger.log(
      `Canceled Stripe subscription ${subscription.id} for user ${subscription.metadata.userId}`,
    );
  }

  async createSubscription({
    customerId,
    priceId,
    metadata,
    paymentMethodId,
  }: {
    customerId: string;
    priceId: string;
    metadata: Metadata;
    paymentMethodId: string;
  }) {
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata,
      expand: ['latest_invoice.payment_intent'],
    });

    this.logger.log(
      `Created Stripe subscription ${subscription.id} for user ${metadata.userId}`,
    );

    return subscription;
  }

  // Webhook Utility
  constructWebhookEvent(rawBody: Buffer, signature: string) {
    const endpointSecret = this.configService.getOrThrow<string>(
      ENVEnum.STRIPE_WEBHOOK_SECRET,
    );
    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        endpointSecret,
      );
    } catch (err) {
      this.logger.error('Invalid webhook signature', err);
      throw new Error('Invalid webhook signature');
    }
  }
}
