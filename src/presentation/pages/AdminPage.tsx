import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createSupabaseClient } from '../../infrastructure/supabase/client'
import { AdminAuthGuard } from '../components/AdminAuthGuard'
import { CategoryAdmin } from './admin/CategoryAdmin'
import { AssetAdmin } from './admin/AssetAdmin'
import { RhythmsAdmin } from './admin/RhythmsAdmin'
import { ThemeAdmin } from './admin/ThemeAdmin'

type Tab = 'categories' | 'assets' | 'rhythms' | 'theme'

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('categories')

  const supabase = useMemo(() => createSupabaseClient(), [])

  return (
    <AdminAuthGuard supabase={supabase}>
      <div className="min-h-screen bg-stone-100">
        <header className="bg-white border-b border-stone-200 px-8 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-900">Prayer Wall Admin</h1>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-heading)] transition-colors"
          >
            <ArrowLeft size={15} />
            View Wall
          </Link>
        </header>

        <nav className="bg-white border-b border-stone-200 px-8">
          <div className="flex">
            {(['categories', 'rhythms', 'assets', 'theme'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {t === 'categories' ? 'Categories' : t === 'rhythms' ? 'Rhythms' : t === 'assets' ? 'Assets' : 'Theme'}
              </button>
            ))}
          </div>
        </nav>

        <main className="px-8 py-8">
          {tab === 'categories' && <CategoryAdmin />}
          {tab === 'rhythms'    && <RhythmsAdmin />}
          {tab === 'assets'     && <AssetAdmin supabase={supabase} />}
          {tab === 'theme'      && <ThemeAdmin supabase={supabase} />}
        </main>
      </div>
    </AdminAuthGuard>
  )
}
