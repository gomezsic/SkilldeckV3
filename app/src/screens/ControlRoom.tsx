import { useEffect, useState } from 'react'
import { Chip } from '../components/ui'
import { appliedAsLabel, capabilityLabel, fmtDate, stepLabel } from '../lib/labels'
import { supabase } from '../lib/supabase'

interface Item { id: string; personId?: string; name: string; detail: string; since: string | null }
interface Board { registered: Item[]; inPath: Item[]; readyQueue: Item[]; titles: Item[] }
const WAIT_FLAG_DAYS = 7

const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : 0)
const fullName = (p: any) => (p ? `${p.first_name} ${p.last_name}` : 'Persona')

/** Sala di controllo del primo tempo: quattro riquadri, ognuno risponde a "chi aspetta me?". */
async function loadBoard(): Promise<Board> {
  const [reg, plans, queue, titles] = await Promise.all([
    supabase.from('person').select('id, first_name, last_name, applied_as, created_at').eq('status', 'registered').neq('family', 'admin').order('created_at'),
    supabase.from('path_plan').select('id, goal_capability, assigned_at, person:person!path_plan_person_id_fkey!inner(id, first_name, last_name, status), path_step(kind, position, status)').eq('status', 'active').eq('person.status', 'in_path').order('assigned_at'),
    supabase.from('ready_queue').select('plan_id, person_id, goal_capability, ready_since').order('ready_since'),
    supabase.from('person_title').select('id, created_at, person(id, first_name, last_name), title_catalog(name_it)').eq('status', 'declared').order('created_at'),
  ])
  for (const r of [reg, plans, queue, titles]) if (r.error) throw r.error

  const queued = new Set((queue.data ?? []).map((q: any) => q.plan_id))
  const names = new Map<string, string>()
  for (const p of plans.data ?? []) names.set((p as any).person.id, fullName((p as any).person))
  const missing = (queue.data ?? []).map((q: any) => q.person_id).filter((id: string) => !names.has(id))
  if (missing.length) {
    const { data } = await supabase.from('person').select('id, first_name, last_name').in('id', missing)
    for (const p of data ?? []) names.set(p.id, fullName(p))
  }

  return {
    registered: (reg.data ?? []).map((p: any) => ({ id: p.id, personId: p.id, name: fullName(p), detail: p.applied_as ? `Si candida come ${appliedAsLabel[p.applied_as]}` : 'Candidatura', since: p.created_at })),
    inPath: (plans.data ?? []).filter((p: any) => !queued.has(p.id)).map((p: any) => {
      const open = [...p.path_step].sort((a, b) => a.position - b.position).find((s) => s.status === 'todo' || s.status === 'in_progress')
      return { id: p.id, personId: p.person.id, name: fullName(p.person), detail: `${capabilityLabel[p.goal_capability] ?? p.goal_capability} · passo aperto: ${open ? stepLabel[open.kind as keyof typeof stepLabel] : 'nessuno'}`, since: p.assigned_at }
    }),
    readyQueue: (queue.data ?? []).map((q: any) => ({ id: q.plan_id, personId: q.person_id, name: names.get(q.person_id) ?? 'Persona', detail: `Obiettivo: ${capabilityLabel[q.goal_capability] ?? q.goal_capability}`, since: q.ready_since })),
    titles: (titles.data ?? []).map((t: any) => ({ id: t.id, personId: t.person?.id, name: fullName(t.person), detail: t.title_catalog?.name_it ?? 'Titolo', since: t.created_at })),
  }
}

export const demoBoard: Board = {
  registered: [
    { id: 'r1', name: 'Elena Prova', detail: 'Si candida come Skipper', since: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    { id: 'r2', name: 'Luca Finto', detail: 'Si candida come Crew', since: new Date(Date.now() - 9 * 86_400_000).toISOString() },
  ],
  inPath: [{ id: 'p1', name: 'Marco Esempio', detail: 'Skipper Flotte · passo aperto: Career', since: new Date(Date.now() - 40 * 86_400_000).toISOString() }],
  readyQueue: [{ id: 'q1', name: 'Anna Modello', detail: 'Obiettivo: Skipper Flotte', since: new Date(Date.now() - 8 * 86_400_000).toISOString() }],
  titles: [
    { id: 't1', name: 'Marco Esempio', detail: 'Certificato radio SRC', since: new Date(Date.now() - 1 * 86_400_000).toISOString() },
    { id: 't2', name: 'Sara Campione', detail: 'First Aid', since: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  ],
}

export default function ControlRoom({ demo, onOpen: setOpenPerson }: { demo: boolean; onOpen: (personId: string) => void }) {
  const [board, setBoard] = useState<Board | null>(demo ? demoBoard : null)
  const [error, setError] = useState<string | null>(null)
  const reload = () => { if (!demo) loadBoard().then(setBoard).catch((e) => setError(e?.message ?? 'Errore di caricamento')) }
  useEffect(reload, [demo])


  if (error) return <p role="alert" className="text-sm text-bad">{error}</p>
  if (!board) return <p className="text-sm text-ink-soft">Carico…</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold">Cabina di regia</h1>
      <p className="mt-1 text-sm text-ink-soft">Chi sta aspettando una tua decisione.</p>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <Tile title="Nuove registrazioni" hint="In attesa di colloquio" empty="Nessuna nuova registrazione." items={board.registered} onOpen={setOpenPerson} />
        <Tile title="Pronti per Ready" hint="Percorso completato, manca la tua conferma" empty="Nessuno in coda." items={board.readyQueue} flagAfter={WAIT_FLAG_DAYS} tone="ok" onOpen={setOpenPerson} />
        <Tile title="In percorso" hint="Con il passo aperto" empty="Nessuno in percorso." items={board.inPath} onOpen={setOpenPerson} />
        <Tile title="Titoli da verificare" hint="Dichiarati, in attesa di controllo" empty="Nessun titolo da verificare." items={board.titles} onOpen={setOpenPerson} />
      </div>
      <p className="mt-4 text-xs text-ink-soft">{demo ? 'Negli esempi le schede non si aprono.' : 'Tocca una persona per aprire la sua scheda con i comandi.'}</p>
    </div>
  )
}

function Tile({ title, hint, empty, items, flagAfter, tone, onOpen }: { title: string; hint: string; empty: string; items: Item[]; flagAfter?: number; tone?: 'ok'; onOpen: (personId: string) => void }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-ink-soft">{hint}</p>
        </div>
        <span className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-base font-semibold ${items.length ? (tone === 'ok' ? 'bg-ok text-white' : 'bg-ink text-white') : 'bg-sand text-ink-soft'}`}>{items.length}</span>
      </div>
      {items.length === 0 ? <p className="mt-3 text-sm text-ink-soft">{empty}</p> : (
        <ul className="mt-2 divide-y divide-line">
          {items.slice(0, 6).map((i) => {
            const d = daysSince(i.since)
            return (
              <li key={i.id}>
                <button type="button" disabled={!i.personId} onClick={() => i.personId && onOpen(i.personId)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left enabled:hover:bg-sand/60">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{i.name}</span>
                  <span className="block truncate text-xs text-ink-soft">{i.detail}</span>
                </span>
                {flagAfter !== undefined && d >= flagAfter
                  ? <Chip tone="warn">In attesa da {d} giorni</Chip>
                  : <span className="shrink-0 text-xs text-ink-soft">{i.since ? fmtDate(i.since.slice(0, 10)) : ''}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {items.length > 6 && <p className="mt-2 text-xs text-ink-soft">e altri {items.length - 6}</p>}
    </section>
  )
}
