export type Metadata = {
  type: 'driver_connect' | 'shelter_connect' | 'transport_payment';
  userId?: string;
  email?: string;
  name?: string;
  priceCents?: number;
  transportId?: string;
  [key: string]: any;
};
