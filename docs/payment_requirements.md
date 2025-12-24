# Payment & Pricing Requirements

This document outlines the business logic, financial architecture, and technical requirements for the animal transport payment system.

## 1. Financial Ecosystem Roles
| Role | Responsibility | Description |
| :--- | :--- | :--- |
| **Payer** | **Shelter** | The source of funds. Responsible for paying transport costs. |
| **Payee** | **Driver** | The recipient. Receives mileage reimbursement or service earnings. |
| **Platform** | **Admin / SuperAdmin** | The governing body. Sets global rates, manages fees, and toggles system-wide modes. |

## 2. Pricing Architecture (Uber-Style Logistics)
The system calculates a "Ride Price" for every transport, regardless of whether payments are currently enabled.

### Base Formula
`Ride Price` = `Base Fare` + (`Distance` × `Per-Mile Rate`) + (`Time` × `Per-Minute Rate`) + `Animal Complexity Adders` + `Platform Fee`

### A. Cost Components
- **Distance**: Calculated via Google Routes API. Default: **$0.65/mile** (IRS Standard).
- **Time**: Traffic or handling time. Default: **$0.00** (Disabled but trackable).
- **Animal Complexity Adders**:
  - `Standard`: $0
  - `Puppy/Kitten`: +$10
  - `Medical Case`: +$20
  - `Special Handling`: +$25
  - `Multi-Animal`: Flat fee per additional animal.

## 3. Implementation Design
### A. Always-On Estimates
The backend must compute and store a **Pricing Snapshot** for every transport.
- **Volunteer Mode**: UI shows: *"Volunteer reimbursement estimate: $XXX.XX (Payments disabled)"*.
- **Paid Mode**: Real money moves via Stripe.

### B. Global Feature Flags (`PaymentSettings`)
Admins control the platform behavior via three toggles:
1. `driverPaymentsEnabled`: Globally enables/disables money transfers.
2. `platformFeesEnabled`: Enables taking a platform commission.
3. `timeBasedPricingEnabled`: Activates per-minute charging.

### C. Historical Integrity
Once a transport is accepted, its pricing is locked via a `PricingSnapshot`. Global rate changes will **not** affect transports already in progress or completed.

## 4. Financial Infrastructure (Stripe Connect)
The platform uses **Stripe Connect Express** for simplified compliance and payouts.
- **Payees**: Drivers onboard via Stripe to provide bank and tax info.
- **Money Flow**: Uses **Destination Charges**. The platform collects the full amount from the Shelter, takes its fee, and Stripe automatically sends the remainder to the Driver.

## 5. Database Schema Requirements
- `PricingRule`: Stores global rates and versions.
- `AnimalComplexityFee`: Stores specific add-ons.
- `PaymentSettings`: Stores global feature flags.
- `PricingSnapshot`: Immutable log of costs for each transport.
- **`Driver`**: Stores `stripeAccountId` (Express) and payout status.
- **`Shelter`**: Stores `stripeCustomerId` to handle automated billing for transports.
- **`Transaction`**: Audit log capturing `StripePaymentIntentId` and `StripeTransferId` to track the movement of real money.
