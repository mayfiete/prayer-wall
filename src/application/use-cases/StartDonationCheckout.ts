import type { IPaymentGateway, CheckoutHandoff } from '../../domain/gateways/IPaymentGateway'
import type { StartDonationCheckoutDto } from '../dto/DonationCheckoutDto'
import { ValidationError } from '../../domain/errors/DomainError'

/** $1.00 — below this most processors charge more in fees than the gift is worth */
export const MIN_DONATION_CENTS = 100
/** $50,000 — sanity ceiling; larger gifts should be handled offline by the school */
export const MAX_DONATION_CENTS = 5_000_000

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

    const fullName = dto.isAnonymous ? undefined : dto.fullName?.trim() || undefined
    if (fullName && fullName.length > 100) {
      throw new ValidationError('Full Name must be 100 characters or fewer')
    }

    return this.paymentGateway.startCheckout({
      givingWallId: dto.givingWallId,
      amountCents: dto.amountCents,
      currency: dto.currency ?? 'usd',
      isAnonymous: dto.isAnonymous ?? false,
      fullName,
    })
  }
}
