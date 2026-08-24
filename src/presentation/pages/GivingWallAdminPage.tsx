import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createSupabaseClient } from '../../infrastructure/supabase/client'
import { AdminAuthGuard } from '../components/AdminAuthGuard'
import { ThemeAdmin } from './admin/ThemeAdmin'
import { AssetAdmin } from './admin/AssetAdmin'
import { RhythmsAdmin } from './admin/RhythmsAdmin'
import { GivingWallDonorsAdmin } from './admin/GivingWallDonorsAdmin'

const GIVING_WALL_ID = (import.meta.env.VITE_GIVING_WALL_ID as string | undefined)?.trim() ?? ''
const GIVING_ORG_ID  = (import.meta.env.VITE_GIVING_ORG_ID  as string | undefined)?.trim()
                    ?? (import.meta.env.VITE_ORG_ID          as string | undefined)?.trim()
                    ?? ''

type Tab = 'rhythms' | 'assets' | 'theme' | 'bricklayers'

const TAB_LABELS: Record<Tab, string> = {
  rhythms:     'Rhythms',
  assets:      'Assets',
  theme:       'Theme',
  bricklayers: 'Bricklayers',
}

export function GivingWallAdminPage() {
  const [tab, setTab] = useState<Tab>('rhythms')

  const supabase = useMemo(() => createSupabaseClient(), [])

  return (
    <AdminAuthGuard supabase={supabase}>
      <div className="min-h-screen bg-stone-100">
        <header className="bg-white border-b border-stone-200 px-8 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-900">Giving Wall Admin</h1>
          <Link
            to="/giving"
            className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-heading)] transition-colors"
          >
            <ArrowLeft size={15} />
            View Wall
          </Link>
        </header>

        <nav className="bg-white border-b border-stone-200 px-8">
          <div className="flex">
            {(['rhythms', 'assets', 'theme', 'bricklayers'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
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

        <main className="px-8 py-8">
          {tab === 'rhythms'     && <RhythmsAdmin supabase={supabase} wallId={GIVING_WALL_ID} orgId={GIVING_ORG_ID} onDone={() => setTab('bricklayers')} />}
          {tab === 'assets'      && <AssetAdmin supabase={supabase} onDone={() => setTab('theme')} />}
          {tab === 'theme'       && <ThemeAdmin supabase={supabase} wallId={GIVING_WALL_ID} onDone={() => setTab('bricklayers')} />}
          {tab === 'bricklayers' && <GivingWallDonorsAdmin supabase={supabase} />}
        </main>
      </div>
    </AdminAuthGuard>
  )
}
