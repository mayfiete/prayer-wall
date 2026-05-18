import { useState, useMemo } from 'react'
import { createSupabaseClient } from '../../infrastructure/supabase/client'
import { AdminAuthGuard } from '../components/AdminAuthGuard'
import { CategoryAdmin } from './admin/CategoryAdmin'
import { AssetAdmin } from './admin/AssetAdmin'
import { RhythmsAdmin } from './admin/RhythmsAdmin'

type Tab = 'categories' | 'assets' | 'rhythms'

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('categories')

  const supabase = useMemo(() => createSupabaseClient(), [])

  return (
    <AdminAuthGuard supabase={supabase}>
      <div className="min-h-screen bg-stone-100">
        <header className="bg-white border-b border-stone-200 px-8 py-5">
          <h1 className="text-xl font-semibold text-stone-900">Prayer Wall Admin</h1>
        </header>

        <nav className="bg-white border-b border-stone-200 px-8">
          <div className="flex">
            {(['categories', 'rhythms', 'assets'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-[#5e061e] text-[#5e061e]'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {t === 'categories' ? 'Categories' : t === 'rhythms' ? 'Rhythms' : 'Assets'}
              </button>
            ))}
          </div>
        </nav>

        <main className="px-8 py-8">
          {tab === 'categories' && <CategoryAdmin />}
          {tab === 'rhythms'    && <RhythmsAdmin />}
          {tab === 'assets'     && <AssetAdmin supabase={supabase} />}
        </main>
      </div>
    </AdminAuthGuard>
  )
}
