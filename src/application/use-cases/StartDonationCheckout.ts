import type { IPaymentGateway, CheckoutHandoff } from '../../domain/gateways/IPaymentGateway'
import type { StartDonationCheckoutDto } from '../dto/DonationCheckoutDto'
import { ValidationError } from '../../domain/errors/DomainError'

/** $1.00 — below this most processors charge more in fees than the gift is worth */
export const MIN_DONATION_CENTS = 100
/** $50,000 — sanity ceiling; larger gifts should be handled offline by the school */
export const MAX_DONATION_CENTS = 5_000_000
/** Matches the column width the brick name is stored in */
export const MAX_NAME_LENGTH = 100

export class StartDonationCheckout {
  constructor(private readonly paymentGateway: IPaymentGateway) {}

  async execute(dto: StartDonationCheckoutDto): Promise<CheckoutHandoff> {
    if (!dto.givingWallId.trim()) {
      throw new ValidationError('This giving wall is not configured yet')
    }
    if (!Number.isInteger(dto.amountCents)) {
      throw new ValidationError('Enter a whole-dollar amount')
    }
    if (dto.amountCents < MIN_DONATION_CENTS) {
      throw new ValidationError(`The minimum gift is $${MIN_DONATION_CENTS / 100}`)
    }
    if (dto.amountCents > MAX_DONATION_CENTS) {
      throw new ValidationError(
        `Gifts above $${(MAX_DONATION_CENTS / 100).toLocaleString('en-US')} can't be given online — please contact the school office`,
      )
    }

    if (dto.monthlyConsent !== true) {
      throw new ValidationError('Please agree to the monthly donation before continuing')
    }

    const firstName = dto.firstName?.trim() ?? ''
    if (!firstName) {
      throw new ValidationError('Enter your first name')
    }

    const fullName = [firstName, dto.lastName?.trim()].filter(Boolean).join(' ')
    if (fullName.length > MAX_NAME_LENGTH) {
      throw new ValidationError(`Your name must be ${MAX_NAME_LENGTH} characters or fewer`)
    }

    return this.paymentGateway.startCheckout({
      givingWallId: dto.givingWallId,
      amountCents: dto.amountCents,
      monthlyConsent: dto.monthlyConsent,
      currency: dto.currency ?? 'usd',
      fullName,
    })
  }
}
