import { useState, useEffect } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../infrastructure/supabase/types'
import { canAccessAdmin } from '../../infrastructure/auth/admin-access'

interface AdminAuthGuardProps {
  supabase: SupabaseClient<Database>
  children: ReactNode
}

export function AdminAuthGuard({ supabase, children }: AdminAuthGuardProps) {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    let version = 0
    const check = async (signedIn: boolean) => {
      const request = ++version
      setAuthed(false)
      setChecking(signedIn)
      if (!signedIn) return
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      if (!active || request !== version) return
      const allowed = await canAccessAdmin(supabase)
      if (active && request === version) {
        setAuthed(allowed)
        setChecking(false)
      }
    }
    // Schedule outside the auth callback to avoid awaiting Supabase within it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void check(!!session)
    })
    return () => { active = false; version++; subscription.unsubscribe() }
  }, [supabase])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError('')
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) {
      setLoginError(error.message)
      return
    }
    if (!await canAccessAdmin(supabase)) {
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
