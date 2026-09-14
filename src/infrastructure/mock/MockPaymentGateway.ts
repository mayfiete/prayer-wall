import type {
  ISimulatedPaymentGateway,
  StartCheckoutInput,
  CheckoutHandoff,
  ConfirmSimulatedPaymentInput,
} from '../../domain/gateways/IPaymentGateway'
import type { Donation } from '../../domain/entities/Donation'
import type { IGivingWallRepository } from '../../domain/repositories/IGivingWallRepository'
import { PaymentDeclinedError, ValidationError } from '../../domain/errors/DomainError'
import type { MockRealtimeClient } from './MockRealtimeClient'

interface TestCardOutcome {
  /** Stripe decline_code; undefined means the payment succeeds */
  declineCode?: string
  message?: string
  /** Simulates a 3D Secure challenge before the payment resolves */
  requiresAuthentication?: boolean
}

/**
 * Stripe's published test card numbers and their documented outcomes. Using the
 * real numbers here means the same cards behave the same way once live Stripe
 * test keys are wired in — nothing to relearn between mock and test mode.
 * https://docs.stripe.com/testing
 */
export const TEST_CARDS: Record<string, TestCardOutcome> = {
  '4242424242424242': {},
  '4000056655665556': {},
  '5555555555554444': {},
  '378282246310005': {},
  '6011111111111117': {},
  '4000002500003155': { requiresAuthentication: true },
  '4000000000000002': { declineCode: 'card_declined', message: 'Your card was declined.' },
  '4000000000009995': { declineCode: 'insufficient_funds', message: 'Your card has insufficient funds.' },
  '4000000000009987': { declineCode: 'lost_card', message: 'Your card was declined.' },
  '4000000000009979': { declineCode: 'stolen_card', message: 'Your card was declined.' },
  '4000000000000069': { declineCode: 'expired_card', message: 'Your card has expired.' },
  '4000000000000127': { declineCode: 'incorrect_cvc', message: "Your card's security code is incorrect." },
  '4000000000000119': { declineCode: 'processing_error', message: 'An error occurred while processing your card. Try again in a little while.' },
}

const PROCESSING_DELAY_MS = 900
const AUTHENTICATION_DELAY_MS = 1_200
const SESSION_DELAY_MS = 250

interface PendingSession {
  givingWallId: string
  amountCents: number
  currency: string
  isAnonymous: boolean
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function randomRef(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
}

export class MockPaymentGateway implements ISimulatedPaymentGateway {
  readonly simulated = true as const

  private readonly sessions = new Map<string, PendingSession>()

  constructor(
    private readonly givingWallRepo: IGivingWallRepository,
    private readonly realtime: MockRealtimeClient,
  ) {}

  async startCheckout(input: StartCheckoutInput): Promise<CheckoutHandoff> {
    await delay(SESSION_DELAY_MS)
    const sessionId = randomRef('cs_test_mock')
    this.sessions.set(sessionId, {
      givingWallId: input.givingWallId,
      amountCents: input.amountCents,
      currency: input.currency,
      isAnonymous: input.isAnonymous,
    })
    return { kind: 'simulated', sessionId }
  }

  async confirmSimulatedPayment(input: ConfirmSimulatedPaymentInput): Promise<Donation> {
    const session = this.sessions.get(input.sessionId)
    if (!session) {
      throw new ValidationError('This checkout session has expired — please start again')
    }

    const digits = input.cardNumber.replace(/\D/g, '')
    const outcome = TEST_CARDS[digits]
    if (!outcome) {
      throw new PaymentDeclinedError(
        'unrecognized_test_card',
        'That is not a recognised test card. Use 4242 4242 4242 4242 to simulate an approved payment.',
      )
    }
    if (!/^\d{2}\s*\/\s*\d{2,4}$/.test(input.expiry.trim())) {
      throw new PaymentDeclinedError('invalid_expiry_date', 'Enter the expiry date as MM/YY.')
    }
    if (!/^\d{3,4}$/.test(input.cvc.trim())) {
      throw new PaymentDeclinedError('invalid_cvc', "Enter the card's 3-digit security code.")
    }

    await delay(PROCESSING_DELAY_MS)
    if (outcome.requiresAuthentication) await delay(AUTHENTICATION_DELAY_MS)

    if (outcome.declineCode) {
      throw new PaymentDeclinedError(outcome.declineCode, outcome.message ?? 'Your card was declined.')
    }

    // Production parity: the webhook — not the browser — decides the brick label.
    const brickName = session.isAnonymous ? 'Anonymous' : (input.wallName ?? input.name)

    const donation = await this.givingWallRepo.create({
      givingWallId: session.givingWallId,
      name: brickName,
      amountCents: session.amountCents,
      currency: session.currency,
      processorRef: randomRef('pi_test_mock'),
    })

    this.sessions.delete(input.sessionId)

    // Mirrors the production path: donations INSERT → realtime → brick animates in.
    this.realtime.emitInsert('donations', {
      id: donation.id,
      giving_wall_id: donation.givingWallId,
      name: donation.name,
      amount_cents: donation.amountCents,
      currency: donation.currency,
      processor_ref: donation.processorRef,
      email_opt_out: donation.emailOptOut,
      donated_at: donation.donatedAt.toISOString(),
    })

    return donation
  }
}
