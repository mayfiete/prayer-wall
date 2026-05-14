import { useState, useMemo } from 'react'
import { createSupabaseClient } from '../../infrastructure/supabase/client'
import { AdminAuthGuard } from '../components/AdminAuthGuard'
import { CategoryAdmin } from './admin/CategoryAdmin'
import { AssetAdmin } from './admin/AssetAdmin'

type Tab = 'categories' | 'assets'

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
            {(['categories', 'assets'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                  tab === t
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {t === 'categories' ? 'Categories' : 'Assets'}
              </button>
            ))}
          </div>
        </nav>

        <main className="px-8 py-8">
          {tab === 'categories' && <CategoryAdmin supabase={supabase} />}
          {tab === 'assets' && <AssetAdmin supabase={supabase} />}
        </main>
      </div>
    </AdminAuthGuard>
  )
}
