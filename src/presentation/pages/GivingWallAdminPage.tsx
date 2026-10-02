import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createSupabaseClient } from '../../infrastructure/supabase/client'
import { AdminAuthGuard } from '../components/AdminAuthGuard'
import { ThemeAdmin } from './admin/ThemeAdmin'
import { AssetAdmin } from './admin/AssetAdmin'
import { RhythmsAdmin } from './admin/RhythmsAdmin'
import { EmailCopyAdmin } from './admin/EmailCopyAdmin'
import { GivingWallDonorsAdmin } from './admin/GivingWallDonorsAdmin'

const GIVING_WALL_ID = (import.meta.env.VITE_GIVING_WALL_ID as string | undefined)?.trim() ?? ''
const GIVING_ORG_ID  = (import.meta.env.VITE_GIVING_ORG_ID  as string | undefined)?.trim()
                    ?? (import.meta.env.VITE_ORG_ID          as string | undefined)?.trim()
                    ?? ''

type Tab = 'rhythms' | 'assets' | 'theme' | 'emails' | 'bricklayers'

const TAB_LABELS: Record<Tab, string> = {
  rhythms:     'Rhythms',
  assets:      'Assets',
  theme:       'Theme',
  emails:      'Emails',
  bricklayers: 'Bricklayers',
}

export function GivingWallAdminPage() {
  const [tab, setTab] = useState<Tab>('rhythms')

  const supabase = useMemo(() => createSupabaseClient(), [])

  return (
    <AdminAuthGuard supabase={supabase}>
      <div className="admin-shell min-h-screen bg-stone-100">
        <header className="bg-white border-b border-stone-200 px-4 py-4 sm:px-8 sm:py-5 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-stone-900">Giving Wall Admin</h1>
          <Link
            to="/giving"
            className="flex min-h-11 items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-heading)] transition-colors"
          >
            <ArrowLeft size={15} />
            View Wall
          </Link>
        </header>

        <nav aria-label="Admin sections" className="bg-white border-b border-stone-200 px-4 sm:px-8">
          <label className="block py-3 md:hidden">
            <span className="mb-1 block text-sm font-medium text-stone-600">Manage</span>
            <select value={tab} onChange={e => setTab(e.target.value as Tab)} className="min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base text-stone-900">
              {(Object.keys(TAB_LABELS) as Tab[]).map(t => <option key={t} value={t}>{TAB_LABELS[t]}</option>)}
            </select>
          </label>
          <div className="hidden flex-wrap md:flex">
            {(['rhythms', 'assets', 'theme', 'emails', 'bricklayers'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-current={tab === t ? 'page' : undefined}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </nav>

        <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
          {tab === 'rhythms'     && <RhythmsAdmin supabase={supabase} wallId={GIVING_WALL_ID} orgId={GIVING_ORG_ID} onDone={() => setTab('bricklayers')} />}
          {tab === 'assets'      && <AssetAdmin supabase={supabase} wallSlug="giving" onDone={() => setTab('theme')} />}
          {tab === 'theme'       && <ThemeAdmin supabase={supabase} wallId={GIVING_WALL_ID} onDone={() => setTab('bricklayers')} />}
          {tab === 'emails'      && <EmailCopyAdmin supabase={supabase} wallId={GIVING_WALL_ID} scope="giving" />}
          {tab === 'bricklayers' && <GivingWallDonorsAdmin supabase={supabase} />}
        </main>
      </div>
    </AdminAuthGuard>
  )
}
