import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useContainer } from '../context/AppContext'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'

type Status = 'loading' | 'success' | 'error' | 'invalid'

export function UnsubscribePage() {
  const [searchParams] = useSearchParams()
  const { unsubscribeFromReminders } = useContainer()
  const [status, setStatus] = useState<Status>('loading')

  const commitmentId = searchParams.get('id')

  useEffect(() => {
    if (!commitmentId) {
      setStatus('invalid')
      return
    }

    unsubscribeFromReminders
      .execute(commitmentId)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [commitmentId, unsubscribeFromReminders])

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 p-6">
      <div className="max-w-sm w-full text-center flex flex-col items-center gap-5">
        {status === 'loading' && (
          <>
            <Loader2 className="animate-spin text-amber-500" size={48} />
            <p className="text-stone-400">Updating your preferences…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="text-amber-500" size={56} />
            <h1 className="text-2xl font-serif font-semibold text-amber-100">
              You've been unsubscribed
            </h1>
            <p className="text-stone-400 text-sm leading-relaxed">
              You will no longer receive weekly prayer reminders. Thank you for
              your time on the prayer wall.
            </p>
            <Link to="/">
              <Button variant="secondary">Return to the prayer wall</Button>
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="text-red-500" size={56} />
            <h1 className="text-xl font-serif font-semibold text-stone-100">
              Something went wrong
            </h1>
            <p className="text-stone-400 text-sm">
              We couldn't process your request. Please try again or contact us.
            </p>
            <Link to="/">
              <Button variant="ghost">Return home</Button>
            </Link>
          </>
        )}

        {status === 'invalid' && (
          <>
            <XCircle className="text-stone-500" size={56} />
            <h1 className="text-xl font-serif font-semibold text-stone-100">
              Invalid link
            </h1>
            <p className="text-stone-400 text-sm">
              This unsubscribe link is missing required information.
            </p>
            <Link to="/">
              <Button variant="ghost">Return home</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
