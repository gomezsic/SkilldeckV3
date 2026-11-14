import { useState } from 'react'
import { demoDecks } from '../lib/demo'
import { supabase } from '../lib/supabase'
import type { Deck } from '../lib/types'
import ControlRoom from './ControlRoom'
import MyDeck from './MyDeck'
import People from './People'
import PersonSheet from './PersonSheet'

/**
 * Ambiente di lavoro dell'amministratore: pensato per il desktop, organizzato per aree di lavoro
 * (non per i quattro mondi dello skipper). Le aree non ancora costruite restano visibili come mappa.
 */
type AreaId = 'regia' | 'persone' | 'formazione' | 'ingaggi' | 'bordo' | 'comunicazioni' | 'contenuti' | 'commerciale' | 'sistema' | 'profilo'
interface Area { id: AreaId; label: string; ready: boolean; items: string[]; when: string }
const areas: Area[] = [
  { id: 'regia', label: 'Cabina di regia', ready: true, items: [], when: '' },
  { id: 'persone', label: 'Persone', ready: true, items: [], when: '' },
  { id: 'formazione', label: 'Formazione', ready: false, when: 'Primo tempo', items: ['Test: sessioni, domande, invitati, risultati', 'Career: edizioni, partecipanti, lezioni, presenze, valutazioni', 'Formatori e proposte di conferma', 'Storico delle Career'] },
  { id: 'ingaggi', label: 'Ingaggi', ready: false, when: 'Secondo tempo', items: ['Calendario e pianificazione per skipper, ingaggio, destinazione', 'Candidature e assegnazioni', 'Lettere di ingaggio', 'Barche e flotte', 'Armatori e offerte da approvare'] },
  { id: 'bordo', label: 'A bordo', ready: false, when: 'Secondo tempo', items: ['Turni: check-in, briefing, viaggio, check-out', 'Danni e cronologia delle barche', 'Salute della flotta'] },
  { id: 'comunicazioni', label: 'Comunicazioni', ready: false, when: 'Primo tempo', items: ['Editor email a blocchi', 'Modelli da approvare', 'Email automatiche con interruttore singolo', 'Campagne in quattro passi', 'Registro degli invii', 'Promemoria'] },
  { id: 'contenuti', label: 'Contenuti', ready: false, when: 'Più avanti', items: ['Base di conoscenza e assistente di bordo', 'Portolano e guide', 'Glossario, traduzioni, COLREG'] },
  { id: 'commerciale', label: 'Commerciale', ready: false, when: 'Più avanti', items: ['Clienti', 'Recensioni', 'Sondaggi', 'Marketing e corsi'] },
  { id: 'sistema', label: 'Sistema', ready: false, when: 'Primo tempo', items: ['Registro delle azioni', 'Simulazione utente in sola lettura', 'Statistiche e attività', 'Errori e salute del database'] },
]

export default function AdminShell({ demo, badge, deck, onRefresh }: { demo: boolean; badge: string; deck: Deck; onRefresh: () => void }) {
  const [area, setArea] = useState<AreaId>('regia')
  const [openPerson, setOpenPerson] = useState<string | null>(null)
  const go = (a: AreaId) => { setArea(a); setOpenPerson(null) }
  const current = areas.find((a) => a.id === area)

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-line bg-ink text-white lg:w-64 lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white"><img src="/logo-mark.png" alt="" className="h-7 w-7" /></span>SkillDeck Pro</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">Admin</span>
        </div>
        <nav aria-label="Aree di lavoro" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible">
          {areas.map((a) => (
            <button key={a.id} type="button" onClick={() => go(a.id)} aria-current={area === a.id ? 'page' : undefined}
              className={`flex h-10 shrink-0 items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap ${area === a.id ? 'bg-white text-ink' : a.ready ? 'text-white hover:bg-white/10' : 'text-white/55 hover:bg-white/10'}`}>
              {a.label}
              {!a.ready && <span className="hidden text-[10px] font-semibold tracking-wide uppercase opacity-70 lg:inline">in arrivo</span>}
            </button>
          ))}
        </nav>
        <div className="hidden border-t border-white/15 px-3 py-3 text-sm lg:block">
          <button type="button" onClick={() => go('profilo')} className={`flex h-10 w-full items-center rounded-lg px-3 font-medium ${area === 'profilo' ? 'bg-white text-ink' : 'hover:bg-white/10'}`}>Il mio profilo</button>
          <div className="mt-2 flex items-center justify-between px-3 text-xs">
            {badge ? <span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">{badge}</span> : <span />}
            <span className="flex gap-3">
              {demo ? <a className="font-medium underline" href={location.pathname}>Esci dagli esempi</a> : (
                <>
                  <a className="font-medium underline" href="?demo=percorso">Esempi</a>
                  <button type="button" className="font-medium underline" onClick={() => void supabase.auth.signOut()}>Esci</button>
                </>
              )}
            </span>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 lg:px-10 lg:py-8">
        <p className="mb-4 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn lg:hidden">L'area amministratore è pensata per il computer. Dal telefono puoi consultarla, ma per lavorare usa il desktop.</p>
        {demo && (
          <nav aria-label="Esempi" className="mb-4 flex flex-wrap gap-2 text-xs">
            {[...Object.keys(demoDecks), 'admin'].map((k) => (
              <a key={k} href={`?demo=${k}`} className={`rounded-full border px-3 py-1.5 font-semibold capitalize ${k === 'admin' ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{k === 'admin' ? 'Amministratore' : k}</a>
            ))}
          </nav>
        )}
        <div className="mx-auto max-w-6xl">
          {openPerson ? <div className="mx-auto max-w-3xl"><PersonSheet personId={openPerson} onBack={() => setOpenPerson(null)} /></div>
            : area === 'regia' ? <ControlRoom demo={demo} onOpen={setOpenPerson} />
            : area === 'persone' ? (demo ? <Placeholder title="Persone" when="" items={['Negli esempi l\'elenco delle persone non è disponibile: entra con il tuo utente.']} /> : <div><h1 className="text-2xl font-semibold">Persone</h1><p className="mt-1 text-sm text-ink-soft">Cerca chiunque e apri la sua scheda con i comandi.</p><People onOpen={setOpenPerson} /></div>)
            : area === 'profilo' ? <div className="mx-auto max-w-2xl"><MyDeck deck={deck} readOnly={demo} onChanged={onRefresh} /></div>
            : current ? <Placeholder title={current.label} when={current.when} items={current.items} /> : null}
        </div>
      </main>
    </div>
  )
}

function Placeholder({ title, when, items }: { title: string; when: string; items: string[] }) {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {when && <span className="rounded-full bg-sea-soft px-2.5 py-1 text-xs font-semibold text-sea">{when}</span>}
      </div>
      <p className="mt-1 text-sm text-ink-soft">{when ? 'Area non ancora costruita. Qui troverai:' : ''}</p>
      <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
        {items.map((i) => <li key={i} className="px-4 py-3 text-sm">{i}</li>)}
      </ul>
    </div>
  )
}
