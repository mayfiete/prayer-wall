export interface StartDonationCheckoutDto {
  givingWallId: string
  amountCents: number
  monthlyConsent: boolean
  currency?: string
  /** Required — the brick has to carry a name */
  firstName: string
  lastName?: string
}

export interface ConfirmSimulatedDonationDto {
  sessionId: string
  name: string
  email: string
  wallName?: string
  cardNumber: string
  expiry: string
  cvc: string
}
