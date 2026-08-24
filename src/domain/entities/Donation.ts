export interface Donation {
  id: string
  givingWallId: string
  /** Display name on the brick — donor-supplied or anonymised */
  name: string
  donatedAt: Date
  /** Amount in smallest currency unit (cents for USD) */
  amountCents: number
  currency: string
  /** Stripe charge/payment-intent ID — authoritative source, set by webhook */
  processorRef: string | null
  emailOptOut: boolean
}

export interface CreateDonationData {
  givingWallId: string
  name: string
  amountCents: number
  currency?: string
  processorRef?: string
}
