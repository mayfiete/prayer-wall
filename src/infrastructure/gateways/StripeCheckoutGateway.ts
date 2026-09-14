import type {
  IPaymentGateway,
  StartCheckoutInput,
  CheckoutHandoff,
} from '../../domain/gateways/IPaymentGateway'
import { createSupabaseClient } from '../supabase/client'
import { PaymentUnavailableError } from '../../domain/errors/DomainError'

type SupabaseClientType = ReturnType<typeof createSupabaseClient>

interface CreateCheckoutResponse {
  url?: string
  session_id?: string
  error?: string
}

interface EdgeFunctionFailure {
  status?: number
  /** The `error` field the edge function returns, when it got far enough to send one */
  message?: string
  /** Raw body, for the console — may be HTML or a gateway error rather than our JSON */
  body?: string
}

/**
 * supabase-js reports a non-2xx edge function response as a FunctionsHttpError
 * whose `message` is only "Edge Function returned a non-2xx status code" — the
 * actual reason is in the untouched Response hanging off `context`.
 */
async function readEdgeFunctionFailure(error: unknown): Promise<EdgeFunctionFailure> {
  const context = (error as { context?: unknown }).context
  if (!(context instanceof Response)) return {}

  const body = await context.clone().text().catch(() => '')
  let message: string | undefined
  try {
    message = (JSON.parse(body) as { error?: string }).error
  } catch { /* not JSON — the raw body is logged instead */ }

  return { status: context.status, message, body }
}

function deployHint(status?: number): string | null {
  if (status === 404) {
    return 'The create-donation-checkout edge function is not deployed. Run: supabase functions deploy create-donation-checkout'
  }
  if (status === 401 || status === 403) {
    return 'The edge function rejected the anon key. Check the function is deployed with JWT verification enabled and that VITE_SUPABASE_ANON_KEY matches this project.'
  }
  if (status === 500) {
    return 'The function ran but failed — check its logs in Supabase → Edge Functions. Most often STRIPE_SECRET_KEY or GIVING_WALL_ID is missing.'
  }
  return null
}

/**
 * Hands the donor off to Stripe-hosted Checkout. Card data is entered on
 * stripe.com, never in this app (PCI SAQ A). The donation row is created later
 * by the giving-wall-webhook edge function — never here.
 *
 * The publishable/secret keys live only in the create-donation-checkout edge
 * function, so nothing Stripe-related ships in the browser bundle.
 */
export class StripeCheckoutGateway implements IPaymentGateway {
  constructor(private readonly supabase: SupabaseClientType) {}

  async startCheckout(input: StartCheckoutInput): Promise<CheckoutHandoff> {
    const returnOrigin = `${window.location.origin}/giving`
    const body = {
      giving_wall_id: input.givingWallId,
      amount_cents: input.amountCents,
      currency: input.currency,
      is_anonymous: input.isAnonymous,
      full_name: input.isAnonymous ? undefined : input.fullName,
      success_url: `${returnOrigin}?checkout=success`,
      cancel_url: `${returnOrigin}?checkout=cancelled`,
    }
    console.info('[donation] create-donation-checkout →', {
      giving_wall_id: body.giving_wall_id,
      amount_cents: body.amount_cents,
      is_anonymous: body.is_anonymous,
    })

    const { data, error } = await this.supabase.functions.invoke<CreateCheckoutResponse>(
      'create-donation-checkout',
      { body },
    )

    if (error) {
      const failure = await readEdgeFunctionFailure(error)
      console.error('[donation] create-donation-checkout failed', {
        name: (error as Error).name,
        message: (error as Error).message,
        status: failure.status,
        responseBody: failure.body,
      })
      const hint = deployHint(failure.status)
      if (hint) console.error('[donation] hint:', hint)
      throw new PaymentUnavailableError(
        failure.message ?? 'Could not reach the payment processor. Please try again.',
      )
    }

    console.info('[donation] create-donation-checkout ←', data)

    if (!data?.url || !data.session_id) {
      console.error('[donation] checkout response is missing url/session_id', data)
      throw new PaymentUnavailableError(
        data?.error ?? 'The payment processor did not return a checkout page',
      )
    }

    return { kind: 'redirect', url: data.url, sessionId: data.session_id }
  }
}
