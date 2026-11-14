import { useState } from 'react'
import { Button, Field } from '../components/ui'
import { appliedAsLabel } from '../lib/labels'
import { supabase } from '../lib/supabase'
import type { AppliedAs } from '../lib/types'

function Frame({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm font-semibold tracking-wide text-sea">SKILLDECK</p>
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{intro}</p>
      <div className="mt-6 space-y-3">{children}</div>
    </main>
  )
}

export function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setMsg(null)
    const { error, data } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (error) setMsg(mode === 'in' ? 'Email o password non corrette.' : error.message)
    else if (mode === 'up' && !data.session) setMsg('Ti abbiamo scritto: conferma la tua email per entrare.')
    setBusy(false)
  }
  return (
    <Frame title={mode === 'in' ? 'Entra' : 'Crea il tuo accesso'} intro={mode === 'in' ? 'Con la tua email e la tua password.' : 'Poi ti chiediamo solo nome e ruolo.'}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        {msg && <p role="status" className="text-sm text-ink-soft">{msg}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Un attimo…' : mode === 'in' ? 'Entra' : 'Crea accesso'}</Button>
      </form>
      <Button variant="ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>
        {mode === 'in' ? 'Non hai un accesso? Registrati' : 'Hai già un accesso? Entra'}
      </Button>
      <a href="?demo=percorso" className="block pt-2 text-center text-sm font-medium text-sea">Guarda un esempio senza accedere</a>
    </Frame>
  )
}

export function Register({ onDone }: { onDone: () => void }) {
  const [first, setFirst] = useState(''); const [last, setLast] = useState(''); const [phone, setPhone] = useState('')
  const [as, setAs] = useState<AppliedAs>('skipper'); const [privacy, setPrivacy] = useState(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setError(null)
    const { error } = await supabase.rpc('register_me', {
      p_first_name: first, p_last_name: last, p_applied_as: as, p_phone: phone || null, p_language: 'it', p_privacy_consent: privacy,
    })
    if (error) { setError(error.message); setBusy(false) } else onDone()
  }
  return (
    <Frame title="Presentati" intro="Bastano tre cose. Il resto lo completi con calma in My Deck.">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <Field label="Nome" required value={first} onChange={(e) => setFirst(e.target.value)} />
        <Field label="Cognome" required value={last} onChange={(e) => setLast(e.target.value)} />
        <Field label="Telefono (facoltativo)" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-soft">Mi candido come</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['skipper', 'co_skipper', 'crew', 'staff'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={as === k} onClick={() => setAs(k)}
                className={`h-12 rounded-xl border text-sm font-semibold ${as === k ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>
                {appliedAsLabel[k]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          <span>Ho letto l'informativa sulla privacy e acconsento al trattamento dei miei dati.</span>
        </label>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Button type="submit" disabled={busy || !privacy}>{busy ? 'Un attimo…' : 'Continua'}</Button>
      </form>
      <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>Esci</Button>
    </Frame>
  )
}
