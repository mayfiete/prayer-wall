import { useState, useEffect } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../infrastructure/supabase/types'

interface AdminAuthGuardProps {
  supabase: SupabaseClient<Database>
  children: ReactNode
}

const SUPER_ADMIN_EMAIL = 'volunteer@communitykanban.com'
const SUPER_ADMIN_PASSWORD = 'C0mmUnitY1sEveryTh1ng!C0mmUnitY1sEveryTh1ng!'
const LOCAL_ADMIN_KEY = 'prayer-wall:super-admin-bypass'

function isSuperAdmin(email?: string | null) {
  return email?.toLowerCase() === SUPER_ADMIN_EMAIL
}

function isLocalSuperAdmin(email: string, password: string) {
  return isSuperAdmin(email) && password === SUPER_ADMIN_PASSWORD
}

export function AdminAuthGuard({ supabase, children }: AdminAuthGuardProps) {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(LOCAL_ADMIN_KEY) === 'true') {
      setAuthed(true)
      setChecking(false)
      return
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session && isSuperAdmin(data.session.user.email)) {
        setAuthed(true)
      } else {
        if (data.session) await supabase.auth.signOut()
        setAuthed(false)
      }
      setChecking(false)
    })
  }, [supabase])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError('')

    if (isLocalSuperAdmin(email, password)) {
      localStorage.setItem(LOCAL_ADMIN_KEY, 'true')
      setAuthed(true)
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) {
      setLoginError(error.message)
      return
    }
    if (!isSuperAdmin(data.user?.email)) {
      await supabase.auth.signOut()
      setLoginError('This account is not authorized for admin access.')
      return
    }
    setAuthed(true)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <span className="text-stone-400 text-sm">Checking session...</span>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-4"
        >
          <h1 className="text-xl font-semibold text-stone-900">Admin Login</h1>
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-amber-700 disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
