import { useState } from 'react'
import { CheckCircle2, CreditCard, FlaskConical, Lock } from 'lucide-react'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { useContainer } from '../context/AppContext'
import { formatCurrency } from '../utils/formatCurrency'
import type { Donation } from '../../domain/entities/Donation'
import { DomainError, PaymentDeclinedError } from '../../domain/errors/DomainError'

const PRESET_AMOUNTS_CENTS = [2500, 5000, 10000, 25000, 50000]

interface DonationCheckoutProps {
  givingWallId: string
  successHeading?: string
  successBody?: string
  submitLabel?: string
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

export function DonationCheckout({
  givingWallId,
  successHeading,
  successBody,
  submitLabel,
}: DonationCheckoutProps) {
  const { startDonationCheckout, confirmSimulatedDonation } = useContainer()

  // A non-null confirmSimulatedDonation means no real processor is configured,
  // so we collect the fields Stripe's hosted page would normally collect.
  const simulated = confirmSimulatedDonation !== null

  const [amountCents, setAmountCents] = useState<number>(PRESET_AMOUNTS_CENTS[1])
  const [customAmount, setCustomAmount] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [wallName, setWallName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Donation | null>(null)

  const selectPreset = (cents: number) => {
    setAmountCents(cents)
    setCustomAmount('')
  }

  const changeCustomAmount = (value: string) => {
    const cleaned = value.replace(/[^\d.]/g, '')
    setCustomAmount(cleaned)
    const dollars = Number.parseFloat(cleaned)
    if (Number.isFinite(dollars)) setAmountCents(Math.round(dollars * 100))
  }

  const fillTestCard = (number: string) => {
    setCardNumber(formatCardNumber(number))
    setExpiry('12/34')
    setCvc('123')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const handoff = await startDonationCheckout.execute({ givingWallId, amountCents, isAnonymous, fullName: wallName })

      if (handoff.kind === 'redirect') {
        // Card details are entered on the processor's domain, never here.
        // Enable "Preserve log" in DevTools to keep these entries across the redirect.
        console.info('[donation] redirecting to processor', handoff.url)
        window.location.assign(handoff.url)
        return
      }

      const donation = await confirmSimulatedDonation!.execute({
        sessionId: handoff.sessionId,
        name,
        email,
        wallName,
        cardNumber,
        expiry,
        cvc,
      })
      setCompleted(donation)
    } catch (err) {
      // Always log the real error — the message shown to the donor is deliberately vague.
      console.error('[donation] checkout failed', err)
      if (err instanceof PaymentDeclinedError || err instanceof DomainError) {
        setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center animate-fade-in">
        <CheckCircle2 className="text-amber-500" size={48} />
        <p className="text-lg font-semibold font-serif" style={{ color: 'var(--color-modal-text)' }}>
          {successHeading ?? 'Your brick has been placed!'}
        </p>
        <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--color-modal-text) 65%, transparent)' }}>
          {successBody ??
            `Thank you for your gift of ${formatCurrency(completed.amountCents, completed.currency)}. Look for “${completed.name}” on the wall.`}
        </p>
      </div>
    )
  }

  const mutedText = 'color-mix(in srgb, var(--color-modal-text) 65%, transparent)'

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" style={{ color: 'color-mix(in srgb, var(--color-modal-text) 80%, transparent)' }}>
          Choose your gift
        </span>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_AMOUNTS_CENTS.map((cents) => {
            const active = !customAmount && amountCents === cents
            return (
              <button
                key={cents}
                type="button"
                onClick={() => selectPreset(cents)}
                className="rounded-md border px-3 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: active ? 'var(--color-modal-accent)' : 'transparent',
                  color: active ? 'var(--color-modal-bg)' : 'var(--color-modal-text)',
                  borderColor: 'color-mix(in srgb, var(--color-modal-text) 25%, transparent)',
                }}
                aria-pressed={active}
              >
                {formatCurrency(cents)}
              </button>
            )
          })}
          <Input
            label=""
            id="custom-amount"
            type="text"
            inputMode="decimal"
            placeholder="Other $"
            value={customAmount}
            onChange={(e) => changeCustomAmount(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: mutedText }}>
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="accent-amber-500"
        />
        Show my brick as “Anonymous”
      </label>

      {!isAnonymous && (
        <Input
          label="Full Name (optional)"
          id="donation-full-name"
          type="text"
          placeholder="Jane Smith or The Smith Family"
          value={wallName}
          onChange={(e) => setWallName(e.target.value)}
          autoComplete="name"
          maxLength={100}
        />
      )}

      {simulated && (
        <>
          <div
            className="flex flex-col gap-2 rounded-md border px-3 py-2.5 text-xs"
            style={{
              borderColor: 'rgba(217, 119, 6, 0.5)',
              backgroundColor: 'rgba(120, 53, 15, 0.25)',
              color: '#fcd34d',
            }}
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <FlaskConical size={13} />
              Simulated checkout — no real payment processor connected
            </span>
            <span>These are Stripe’s official test numbers and behave the same once test keys are wired in.</span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button type="button" onClick={() => fillTestCard('4242424242424242')} className="rounded border border-amber-600/60 px-2 py-1 hover:bg-amber-900/40">
                Approved · 4242…
              </button>
              <button type="button" onClick={() => fillTestCard('4000000000000002')} className="rounded border border-amber-600/60 px-2 py-1 hover:bg-amber-900/40">
                Declined · 4000…0002
              </button>
              <button type="button" onClick={() => fillTestCard('4000000000009995')} className="rounded border border-amber-600/60 px-2 py-1 hover:bg-amber-900/40">
                No funds · 4000…9995
              </button>
              <button type="button" onClick={() => fillTestCard('4000002500003155')} className="rounded border border-amber-600/60 px-2 py-1 hover:bg-amber-900/40">
                3DS · 4000…3155
              </button>
            </div>
          </div>

          <Input
            label="Name on card"
            type="text"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
          <Input
            label="Email address"
            type="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Card number"
            type="text"
            inputMode="numeric"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Expiry"
              type="text"
              inputMode="numeric"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              required
            />
            <Input
              label="CVC"
              type="text"
              inputMode="numeric"
              placeholder="123"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
            />
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting} size="lg" className="w-full mt-1">
        {submitting
          ? 'Processing…'
          : (submitLabel ??
            (simulated
              ? `Give ${formatCurrency(amountCents)}`
              : `Continue to secure checkout · ${formatCurrency(amountCents)}`))}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-center" style={{ color: mutedText }}>
        {simulated ? <CreditCard size={12} /> : <Lock size={12} />}
        {simulated
          ? 'Nothing is charged and no card details leave this browser tab.'
          : 'Payment is completed on Stripe’s secure page — card details never touch this site.'}
      </p>
    </form>
  )
}
