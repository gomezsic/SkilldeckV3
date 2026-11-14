import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { loadDeck } from './lib/deck'
import { demoDecks } from './lib/demo'
import { envLabel, supabase } from './lib/supabase'
import type { Deck } from './lib/types'
import { Register, SignIn } from './screens/Access'
import ControlRoom from './screens/ControlRoom'
import MyDeck from './screens/MyDeck'
import Today from './screens/Today'

type Tab = 'today' | 'job' | 'deck' | 'skills'
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5-1.4 1.4M7.9 16.1l-1.4 1.4m0-12 1.4 1.4m8.2 8.2 1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'job', label: 'My Job', icon: 'M4 8h16v11H4zM9 8V5h6v3' },
  { id: 'deck', label: 'My Deck', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0' },
  { id: 'skills', label: 'My Skills', icon: 'M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z' },
]
const soon: Record<'job' | 'skills', string> = {
  job: 'Qui arriveranno bacheca, candidature e ingaggi, nel secondo tempo.',
  skills: 'Qui arriveranno Career, formazione e crescita.',
}

export default function App() {
  const demoKey = new URLSearchParams(location.search).get('demo')
  const demo = demoKey ? demoDecks[demoKey] ?? (demoKey === 'admin' ? { ...demoDecks.registrato, person: { ...demoDecks.registrato.person, first_name: 'Admin', last_name: 'Esempio', family: 'admin' as const, applied_as: null } } : demoDecks.percorso) : null

  const [session, setSession] = useState<Session | null | undefined>(demo ? null : undefined)
  const [deck, setDeck] = useState<Deck | null | undefined>(demo ?? undefined)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('today')

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

  const isAdmin = deck.person.family === 'admin' || demoKey === 'admin'
  const badge = demo ? 'Dati di esempio' : envLabel
  const exit = demo
    ? <a className="font-medium text-sea" href={location.pathname}>Esci dagli esempi</a>
    : (
      <span className="flex items-center gap-3">
        {isAdmin && <a className="font-medium text-sea" href="?demo=admin">Esempi</a>}
        <button type="button" className="font-medium text-sea" onClick={() => void supabase.auth.signOut()}>Esci</button>
      </span>
    )

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col lg:max-w-none lg:flex-row">
      {/* Desktop: menu di lato */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-card px-4 py-6 lg:flex">
        <span className="px-3"><span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink"><img src="/logo-mark.png" alt="" width="32" height="32" className="h-8 w-8" />SkillDeck Pro</span></span>
        <nav aria-label="Sezioni" className="mt-6 flex-1 space-y-1">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
              className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium ${tab === t.id ? 'bg-ink text-white' : 'text-ink-soft hover:bg-sand'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={t.icon} /></svg>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center justify-between px-3 text-xs">
          {badge ? <span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">{badge}</span> : <span />}
          {exit}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:hidden">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink"><img src="/logo-mark.png" alt="" width="32" height="32" className="h-8 w-8" />SkillDeck Pro</span>
          <span className="flex items-center gap-2 text-xs text-ink-soft">
            {badge && <span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">{badge}</span>}
            {exit}
          </span>
        </div>

        <main className={`w-full flex-1 px-4 pb-28 lg:mx-auto lg:px-8 lg:py-8 ${isAdmin && tab === 'today' ? 'lg:max-w-5xl' : 'lg:max-w-2xl'}`}>
          {demo && (
            <nav aria-label="Esempi" className="mb-3 flex flex-wrap gap-2 text-xs">
              {[...Object.keys(demoDecks), 'admin'].map((k) => (
                <a key={k} href={`?demo=${k}`} className={`rounded-full border px-3 py-1.5 font-semibold capitalize ${k === demoKey ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{k === 'admin' ? 'Amministratore' : k}</a>
              ))}
            </nav>
          )}
          {tab === 'deck' ? <MyDeck deck={deck} readOnly={!!demo} onChanged={refresh} />
            : tab === 'today' ? (isAdmin ? <ControlRoom demo={!!demo} /> : <Today deck={deck} onOpenDeck={() => { setTab('deck'); scrollTo(0, 0) }} />)
            : (
              <div className="mt-16 text-center">
                <h1 className="text-xl font-semibold">{tabs.find((t) => t.id === tab)?.label}</h1>
                <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">{soon[tab]}</p>
              </div>
            )}
        </main>
      </div>

      <nav aria-label="Sezioni" className="fixed inset-x-0 bottom-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
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
