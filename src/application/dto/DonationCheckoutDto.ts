export interface StartDonationCheckoutDto {
  givingWallId: string
  amountCents: number
  currency?: string
  isAnonymous?: boolean
  fullName?: string
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
