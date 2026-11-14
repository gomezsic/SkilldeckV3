import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { loadDeck } from './lib/deck'
import { demoDecks } from './lib/demo'
import { envLabel, supabase } from './lib/supabase'
import type { Deck } from './lib/types'
import { Register, SignIn } from './screens/Access'
import MyDeck from './screens/MyDeck'

type Tab = 'today' | 'job' | 'deck' | 'skills'
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5-1.4 1.4M7.9 16.1l-1.4 1.4m0-12 1.4 1.4m8.2 8.2 1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'job', label: 'My Job', icon: 'M4 8h16v11H4zM9 8V5h6v3' },
  { id: 'deck', label: 'My Deck', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0' },
  { id: 'skills', label: 'My Skills', icon: 'M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z' },
]
const soon: Record<Exclude<Tab, 'deck'>, string> = {
  today: 'Qui troverai una cosa sola: il prossimo passo da fare.',
  job: 'Qui arriveranno bacheca, candidature e ingaggi, nel secondo tempo.',
  skills: 'Qui arriveranno Career, formazione e crescita.',
}

export default function App() {
  const demoKey = new URLSearchParams(location.search).get('demo')
  const demo = demoKey ? demoDecks[demoKey] ?? demoDecks.percorso : null

  const [session, setSession] = useState<Session | null | undefined>(demo ? null : undefined)
  const [deck, setDeck] = useState<Deck | null | undefined>(demo ?? undefined)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('deck')

  useEffect(() => {
    if (demo) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [demo])

  const refresh = useCallback(() => {
    if (demo) return
    setError(null)
    loadDeck().then(setDeck).catch((e) => setError(e?.message ?? 'Errore di caricamento'))
  }, [demo])
  useEffect(() => { if (session) refresh(); else if (session === null && !demo) setDeck(undefined) }, [session, refresh, demo])

  if (!demo) {
    if (session === undefined) return <Splash />
    if (session === null) return <SignIn />
    if (error) return <Splash text={error} />
    if (deck === undefined) return <Splash />
    if (deck === null) return <Register onDone={refresh} />
  }
  if (!deck) return <Splash />

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-sm font-semibold tracking-wide text-sea">SKILLDECK</span>
        <span className="flex items-center gap-2 text-xs text-ink-soft">
          {demo ? <span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">Dati di esempio</span>
            : envLabel && <span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">{envLabel}</span>}
          {demo ? <a className="font-medium text-sea" href={location.pathname}>Esci</a>
            : <button type="button" className="font-medium text-sea" onClick={() => void supabase.auth.signOut()}>Esci</button>}
        </span>
      </div>

      <main className="flex-1 px-4 pb-28">
        {demo && (
          <nav aria-label="Esempi" className="mb-3 flex gap-2 text-xs">
            {Object.keys(demoDecks).map((k) => (
              <a key={k} href={`?demo=${k}`} className={`rounded-full border px-3 py-1.5 font-semibold capitalize ${k === demoKey ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{k}</a>
            ))}
          </nav>
        )}
        {tab === 'deck' ? <MyDeck deck={deck} readOnly={!!demo} onChanged={refresh} /> : (
          <div className="mt-16 text-center">
            <h1 className="text-xl font-semibold">{tabs.find((t) => t.id === tab)?.label}</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">{soon[tab]}</p>
          </div>
        )}
      </main>

      <nav aria-label="Sezioni" className="fixed inset-x-0 bottom-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
                className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium ${tab === t.id ? 'text-ink' : 'text-ink-soft'}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === t.id ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={t.icon} /></svg>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function Splash({ text }: { text?: string }) {
  return <div className="grid min-h-full place-items-center px-6 text-center text-sm text-ink-soft">{text ?? 'Carico…'}</div>
}
