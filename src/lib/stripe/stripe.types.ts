export type Metadata = {
  type: 'subscription' | 'onboarding_subscription' | 'transport_payment';
  userId?: string;
  email?: string;
  name?: string;
  planId?: string;
  planTitle?: string;
  priceCents?: number;
  stripeProductId?: string;
  stripePriceId?: string;
  transportId?: string;
  [key: string]: any;
};
