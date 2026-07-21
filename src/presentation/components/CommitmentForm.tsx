import { useState } from 'react'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { CategorySelector } from './CategorySelector'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { ValidationError } from '../../domain/errors/DomainError'
import { useContainer } from '../context/AppContext'
import { supabaseClient } from '../../infrastructure/supabase/client'
import { CheckCircle2 } from 'lucide-react'

interface CommitmentFormProps {
  wallId: string
  orgId: string
  categories: PrayerCategory[]
  onSuccess: () => void
}

export function CommitmentForm({ wallId, orgId, categories, onSuccess }: CommitmentFormProps) {
  const { submitPrayerCommitment } = useContainer()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; categories?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)

    const errors: typeof fieldErrors = {}
    if (!name.trim()) errors.name = 'Name is required'
    if (!email.trim() || !email.includes('@')) errors.email = 'A valid email is required'
    if (categoryIds.length === 0) errors.categories = 'Select at least one prayer category'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      const newPrayer = await submitPrayerCommitment.execute({ wallId, orgId, name, email, categoryIds })
      setSubmitted(true)
      setTimeout(onSuccess, 1800)
      supabaseClient?.functions.invoke('send-confirmation', {
        body: { commitment_id: newPrayer.id },
      }).catch((err: unknown) => console.error('[send-confirmation]', err))
    } catch (err) {
      if (err instanceof ValidationError) {
        setServerError(err.message)
      } else {
        setServerError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center animate-fade-in">
        <CheckCircle2 className="text-amber-500" size={48} />
        <p className="text-stone-100 font-semibold text-lg font-serif">Your stone has been placed!</p>
        <p className="text-stone-400 text-sm">You will receive weekly prayer reminders by email.</p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5" noValidate>
      <Input
        label="Your name"
        type="text"
        placeholder="Jane Smith"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        autoComplete="name"
        required
      />
      <Input
        label="Email address"
        type="email"
        placeholder="jane@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        autoComplete="email"
        required
      />
      <div className="flex flex-col gap-1">
        <CategorySelector
          categories={categories}
          selected={categoryIds}
          onChange={setCategoryIds}
        />
        {fieldErrors.categories && (
          <p className="text-xs text-red-400">{fieldErrors.categories}</p>
        )}
      </div>
      {serverError && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md px-3 py-2">
          {serverError}
        </p>
      )}
      <Button type="submit" disabled={submitting} size="lg" className="w-full mt-1">
        {submitting ? 'Adding your stone…' : 'Add my stone to the foundation!'}
      </Button>
      <p className="text-xs text-stone-500 text-center">
        Your email is never displayed publicly. You can unsubscribe from reminders at any time.
      </p>
    </form>
  )
}
