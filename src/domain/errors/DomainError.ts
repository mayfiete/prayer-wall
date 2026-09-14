export class DomainError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

/**
 * Checkout could not be started at all — the processor was unreachable, not
 * deployed, or misconfigured. Nothing was charged and the donor can retry.
 * Distinct from PaymentDeclinedError, where the processor answered and said no.
 */
export class PaymentUnavailableError extends DomainError {
  constructor(message: string) {
    super(message, 'PAYMENT_UNAVAILABLE')
    this.name = 'PaymentUnavailableError'
  }
}

/**
 * The payment processor refused the payment. `declineCode` mirrors Stripe's
 * decline_code (card_declined, insufficient_funds, expired_card, …) so the
 * mock and real gateways surface failures identically.
 */
export class PaymentDeclinedError extends DomainError {
  readonly declineCode: string

  constructor(declineCode: string, message: string) {
    super(message, 'PAYMENT_DECLINED')
    this.name = 'PaymentDeclinedError'
    this.declineCode = declineCode
  }
}
