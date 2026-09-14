import type { ISimulatedPaymentGateway } from '../../domain/gateways/IPaymentGateway'
import type { Donation } from '../../domain/entities/Donation'
import type { ConfirmSimulatedDonationDto } from '../dto/DonationCheckoutDto'
import { ValidationError } from '../../domain/errors/DomainError'

/**
 * Mock-mode only. Stands in for the fields the processor-hosted checkout page
 * would collect, so the giving wall can be exercised end to end without keys.
 * Wired in container.ts only when the gateway is simulated.
 */
export class ConfirmSimulatedDonation {
  constructor(private readonly paymentGateway: ISimulatedPaymentGateway) {}

  async execute(dto: ConfirmSimulatedDonationDto): Promise<Donation> {
    if (!dto.sessionId.trim()) {
      throw new ValidationError('This checkout session has expired — please start again')
    }
    if (!dto.name.trim()) {
      throw new ValidationError('Name is required')
    }
    if (!dto.email.trim() || !dto.email.includes('@')) {
      throw new ValidationError('A valid email address is required')
    }

    return this.paymentGateway.confirmSimulatedPayment({
      sessionId: dto.sessionId,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      wallName: dto.wallName?.trim() || undefined,
      cardNumber: dto.cardNumber,
      expiry: dto.expiry,
      cvc: dto.cvc,
    })
  }
}
