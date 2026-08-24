import { useState, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import { Loader2 } from 'lucide-react'

const GIVING_WALL_ID = (import.meta.env.VITE_GIVING_WALL_ID as string | undefined)?.trim() ?? ''

type DonationRow = Omit<Database['prayer_wall']['Tables']['donations']['Row'], 'email'>

interface GivingWallDonorsAdminProps {
  supabase: SupabaseClient<Database>
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

export function GivingWallDonorsAdmin({ supabase }: GivingWallDonorsAdminProps) {
  const [donations, setDonations] = useState<DonationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!GIVING_WALL_ID) { setLoading(false); return }
    supabase
      .from('donations')
      .select('id, giving_wall_id, name, amount_cents, currency, processor, processor_ref, email_opt_out, donated_at, created_at')
      .eq('giving_wall_id', GIVING_WALL_ID)
      .order('donated_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setDonations(data ?? [])
        setLoading(false)
      })
  }, [supabase])

  const totalCents = donations.reduce((sum, d) => sum + d.amount_cents, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-[var(--color-primary)]" size={32} />
    </div>
  )

  if (error) return <p className="text-sm text-red-500 py-8">{error}</p>

  if (!GIVING_WALL_ID) return (
    <p className="text-sm text-stone-400 py-8">
      Set <code className="bg-stone-100 px-1 rounded text-xs">VITE_GIVING_WALL_ID</code> to load donors.
    </p>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-heading)]">Bricklayers</h2>
          <p className="text-xs text-stone-400 mt-0.5">{donations.length} donation{donations.length !== 1 ? 's' : ''}</p>
        </div>
        {donations.length > 0 && (
          <p className="text-sm font-semibold text-[var(--color-heading)]">
            Total: {formatAmount(totalCents, donations[0]?.currency ?? 'usd')}
          </p>
        )}
      </div>

      {donations.length === 0 ? (
        <p className="text-sm text-stone-400">No donations yet.</p>
      ) : (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-xs text-stone-400 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Name</th>
                <th className="px-5 py-3 text-left font-medium">Amount</th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3 text-left font-medium">Processor ref</th>
                <th className="px-5 py-3 text-left font-medium">Email opt-out</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-stone-800">{d.name}</td>
                  <td className="px-5 py-3 text-stone-700">{formatAmount(d.amount_cents, d.currency)}</td>
                  <td className="px-5 py-3 text-stone-500">{new Date(d.donated_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-stone-400 font-mono text-xs">{d.processor_ref ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${d.email_opt_out ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                      {d.email_opt_out ? 'Opted out' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
