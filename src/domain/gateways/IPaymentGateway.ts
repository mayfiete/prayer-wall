import type { Donation } from '../entities/Donation'

export interface StartCheckoutInput {
  givingWallId: string
  /** Amount in smallest currency unit (cents for USD) */
  amountCents: number
  currency: string
  /** When true the brick reads "Anonymous" regardless of the name the processor returns */
  isAnonymous: boolean
  /** Optional public name entered before hosted checkout */
  fullName?: string
}

/**
 * Where the donor goes next once we hand off to the payment processor.
 * - redirect  → real processor-hosted checkout page (card data never touches our app)
 * - simulated → no processor available; the app renders a fake card form instead
 */
export type CheckoutHandoff =
  | { kind: 'redirect'; url: string; sessionId: string }
  | { kind: 'simulated'; sessionId: string }

export interface IPaymentGateway {
  startCheckout(input: StartCheckoutInput): Promise<CheckoutHandoff>
}

export interface ConfirmSimulatedPaymentInput {
  sessionId: string
  /** Payer name, as the processor's hosted page would collect it */
  name: string
  email: string
  /** Optional override for the brick label — falls back to `name` when blank */
  wallName?: string
  cardNumber: string
  expiry: string
  cvc: string
}

/**
 * Implemented only by gateways that fake a payment locally (mock mode).
 * Real processors never expose this — card data is entered on their domain,
 * and the donation row is created by their webhook, not the browser.
 */
export interface ISimulatedPaymentGateway extends IPaymentGateway {
  readonly simulated: true
  confirmSimulatedPayment(input: ConfirmSimulatedPaymentInput): Promise<Donation>
}

export function isSimulatedGateway(gateway: IPaymentGateway): gateway is ISimulatedPaymentGateway {
  return (gateway as ISimulatedPaymentGateway).simulated === true
}
