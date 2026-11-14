import { useState } from 'react'
import { Button, Field } from '../components/ui'
import { supabase } from '../lib/supabase'

function Frame({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10">
      <img src="/logo.png" alt="SkillDeck Pro. All your skills on deck." width="640" height="376" className="h-auto w-56" />
      <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{intro}</p>
      <div className="mt-6 space-y-3">{children}</div>
    </main>
  )
}

/** I messaggi del servizio di accesso arrivano in inglese: qui diventano italiano, con un consiglio su cosa fare. */
function explain(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('is invalid')) return 'Questo indirizzo email non viene accettato. Controlla di averlo scritto bene, oppure prova con un altro indirizzo.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Con questa email esiste già un accesso: premi "Hai già un accesso? Entra".'
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Troppi tentativi ravvicinati: aspetta un minuto e riprova.'
  if (m.includes('password')) return 'La password non va bene: servono almeno 8 caratteri.'
  if (m.includes('not confirmed')) return 'Devi prima confermare la tua email: cerca il nostro messaggio nella posta.'
  if (m.includes('provider is not enabled')) return 'L\'accesso con Google non è ancora attivo.'
  return 'Non siamo riusciti a completare la richiesta. Riprova tra poco.'
}
const GOOGLE_ON = import.meta.env.VITE_GOOGLE_LOGIN === '1'

export function SignIn() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setMsg(error.message.toLowerCase().includes('not confirmed') ? explain(error.message) : 'Email o password non corrette. Se non hai ancora un accesso, parti dalla candidatura qui sotto.')
    setBusy(false)
  }
  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setMsg(explain(error.message))
  }
  return (
    <Frame title="Entra" intro="Con la tua email e la tua password.">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {msg && <p role="status" className="text-sm text-ink-soft">{msg}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Un attimo…' : 'Entra'}</Button>
      </form>
      {GOOGLE_ON && <Button variant="ghost" onClick={() => void google()}>Entra con Google</Button>}
      <div className="border-t border-line pt-4">
        <p className="mb-2 text-sm font-medium text-ink-soft">Non hai ancora un accesso? Candidati.</p>
        <div className="space-y-2">
          <a href="#/diventa-skipper" className="grid h-12 place-items-center rounded-xl bg-sea px-4 text-base font-semibold text-white">Candidati come Skipper</a>
          <a href="#/diventa-crew" className="grid min-h-12 place-items-center rounded-xl border border-line bg-card px-4 py-2 text-center text-base font-semibold">Candidati come Crew Assistant / Staff di bordo</a>
        </div>
      </div>
      <a href="?demo=percorso" className="block pt-2 text-center text-sm font-medium text-sea">Guarda un esempio senza accedere</a>
    </Frame>
  )
}
