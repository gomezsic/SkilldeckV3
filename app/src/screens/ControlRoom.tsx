import { useEffect, useState } from 'react'
import { Chip } from '../components/ui'
import { appliedAsLabel, capabilityLabel, fmtDate, stepLabel } from '../lib/labels'
import { friendly } from '../lib/friendly'
import { supabase } from '../lib/supabase'
import { fmtSlot, trackLabel } from '../lib/application'
import InterviewSettings from './InterviewSettings'

interface Item { id: string; personId?: string; name: string; detail: string; since: string | null }
interface Board { memos: Item[]; interviews: Item[]; registered: Item[]; inPath: Item[]; readyQueue: Item[]; titles: Item[]; expiring: Item[]; counts: Record<string, number> }
const EXPIRY_DAYS = 90
const kindLabel: Record<string, string> = { title: 'Titolo', identity_document: 'Documento', insurance: 'Assicurazione' }
const WAIT_FLAG_DAYS = 7

const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : 0)
const fullName = (p: any) => (p ? `${p.first_name} ${p.last_name}` : 'Persona')

/** Sala di controllo del primo tempo: quattro riquadri, ognuno risponde a "chi aspetta me?". */
async function loadBoard(): Promise<Board> {
  const [reg, plans, queue, titles, exp, people, ivs, memos] = await Promise.all([
    supabase.from('person').select('id, first_name, last_name, applied_as, created_at').eq('status', 'registered').neq('family', 'admin').is('archived_at', null).order('created_at'),
    supabase.from('path_plan').select('id, goal_capability, assigned_at, person:person!path_plan_person_id_fkey!inner(id, first_name, last_name, status), path_step(kind, position, status)').eq('status', 'active').eq('person.status', 'in_path').is('person.archived_at', null).order('assigned_at'),
    supabase.from('ready_queue').select('plan_id, person_id, goal_capability, ready_since').order('ready_since'),
    supabase.from('person_title').select('id, created_at, person(id, first_name, last_name), title_catalog(name_it)').eq('status', 'declared').is('archived_at', null).order('created_at'),
    supabase.rpc('expiring', { p_days: EXPIRY_DAYS }),
    supabase.from('person').select('id, first_name, last_name, status').neq('family', 'admin').is('archived_at', null),
    supabase.from('interview_request').select('id, person_id, status, preferred_slots, scheduled_start, created_at').in('status', ['pending', 'scheduled', 'completed']).order('created_at', { ascending: false }),
    supabase.from('person_note').select('id, person_id, body, due_on, created_at').eq('kind', 'memo').is('done_at', null).order('due_on', { nullsFirst: false }),
  ])
  for (const r of [reg, plans, queue, titles, exp, people, ivs, memos]) if (r.error) throw r.error
  const interviewOf = new Map<string, any>()
  for (const i of ivs.data ?? []) if (!interviewOf.has(i.person_id)) interviewOf.set(i.person_id, i)
  const interviewText = (i: any) => !i ? 'senza richiesta di colloquio'
    : i.status === 'pending' ? `colloquio da fissare · ${i.preferred_slots.length} ${i.preferred_slots.length === 1 ? 'data proposta' : 'date proposte'}`
    : i.status === 'scheduled' ? `colloquio fissato: ${fmtSlot(i.scheduled_start)}` : 'colloquio fatto · da decidere'
  const counts: Record<string, number> = { total: 0 }
  const allNames = new Map<string, string>()
  for (const p of people.data ?? []) { counts.total++; counts[p.status] = (counts[p.status] ?? 0) + 1; allNames.set(p.id, fullName(p)) }

  const queued = new Set((queue.data ?? []).map((q: any) => q.plan_id))
  const names = new Map<string, string>()
  for (const p of plans.data ?? []) names.set((p as any).person.id, fullName((p as any).person))
  const missing = (queue.data ?? []).map((q: any) => q.person_id).filter((id: string) => !names.has(id))
  if (missing.length) {
    const { data } = await supabase.from('person').select('id, first_name, last_name').in('id', missing)
    for (const p of data ?? []) names.set(p.id, fullName(p))
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  return {
    memos: (memos.data ?? []).filter((m: any) => allNames.has(m.person_id)).map((m: any) => ({ id: m.id, personId: m.person_id, name: allNames.get(m.person_id) ?? 'Persona', detail: `${m.due_on && m.due_on < todayIso ? 'In ritardo · ' : ''}${m.body}`, since: m.due_on })),
    registered: (reg.data ?? []).map((p: any) => ({ id: p.id, personId: p.id, name: fullName(p), detail: `${trackLabel[p.applied_as] ?? appliedAsLabel[p.applied_as] ?? 'Candidatura'} · ${interviewText(interviewOf.get(p.id))}`, since: p.created_at })),
    interviews: (ivs.data ?? []).filter((i: any) => i.status === 'scheduled' && allNames.has(i.person_id)).sort((a: any, b: any) => a.scheduled_start.localeCompare(b.scheduled_start))
      .map((i: any) => ({ id: i.id, personId: i.person_id, name: allNames.get(i.person_id) ?? 'Persona', detail: fmtSlot(i.scheduled_start), since: null })),
    inPath: (plans.data ?? []).filter((p: any) => !queued.has(p.id)).map((p: any) => {
      const open = [...p.path_step].sort((a, b) => a.position - b.position).find((s) => s.status === 'todo' || s.status === 'in_progress')
      return { id: p.id, personId: p.person.id, name: fullName(p.person), detail: `${capabilityLabel[p.goal_capability] ?? p.goal_capability} · passo aperto: ${open ? stepLabel[open.kind as keyof typeof stepLabel] : 'nessuno'}`, since: p.assigned_at }
    }),
    readyQueue: (queue.data ?? []).map((q: any) => ({ id: q.plan_id, personId: q.person_id, name: names.get(q.person_id) ?? 'Persona', detail: `Obiettivo: ${capabilityLabel[q.goal_capability] ?? q.goal_capability}`, since: q.ready_since })),
    counts,
    expiring: (exp.data ?? []).map((e: any, i: number) => ({ id: `${e.person_id}-${i}`, personId: e.person_id, name: allNames.get(e.person_id) ?? 'Persona', detail: `${kindLabel[e.kind] ?? e.kind}: ${e.label}${new Date(e.expires_on) < new Date() ? ' · scaduto' : ''}`, since: e.expires_on })),
    titles: (titles.data ?? []).map((t: any) => ({ id: t.id, personId: t.person?.id, name: fullName(t.person), detail: t.title_catalog?.name_it ?? 'Titolo', since: t.created_at })),
  }
}

export const demoBoard: Board = {
  memos: [{ id: 'm1', name: 'Elena Prova', detail: 'Mandarle il link della Career e il programma', since: new Date(Date.now() + 2 * 86_400_000).toISOString() }],
  interviews: [{ id: 'i1', name: 'Luca Finto', detail: 'giovedì 19 novembre, ore 17:30', since: null }],
  registered: [
    { id: 'r1', name: 'Elena Prova', detail: 'Skipper · colloquio da fissare · 3 date proposte', since: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    { id: 'r2', name: 'Luca Finto', detail: 'Crew Assistant / Staff di bordo · colloquio fissato: giovedì 19 novembre, ore 17:30', since: new Date(Date.now() - 9 * 86_400_000).toISOString() },
  ],
  inPath: [{ id: 'p1', name: 'Marco Esempio', detail: 'Skipper Flotte · passo aperto: Career', since: new Date(Date.now() - 40 * 86_400_000).toISOString() }],
  readyQueue: [{ id: 'q1', name: 'Anna Modello', detail: 'Obiettivo: Skipper Flotte', since: new Date(Date.now() - 8 * 86_400_000).toISOString() }],
  counts: { total: 6, registered: 2, in_path: 2, ready: 2 },
  expiring: [{ id: 'e1', name: 'Sara Campione', detail: 'Titolo: FIRST_AID', since: new Date(Date.now() + 41 * 86_400_000).toISOString() }],
  titles: [
    { id: 't1', name: 'Marco Esempio', detail: 'Certificato radio SRC', since: new Date(Date.now() - 1 * 86_400_000).toISOString() },
    { id: 't2', name: 'Sara Campione', detail: 'First Aid', since: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  ],
}

export default function ControlRoom({ demo, onOpen: setOpenPerson }: { demo: boolean; onOpen: (personId: string) => void }) {
  const [board, setBoard] = useState<Board | null>(demo ? demoBoard : null)
  const [error, setError] = useState<string | null>(null)
  const reload = () => { if (!demo) loadBoard().then(setBoard).catch((e) => setError(friendly(e, 'leggere i dati'))) }
  useEffect(reload, [demo])


  if (error) return <p role="alert" className="text-sm text-bad">{error}</p>
  if (!board) return <p className="text-sm text-ink-soft">Carico…</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold">Cabina di regia</h1>
      <p className="mt-1 text-sm text-ink-soft">Chi sta aspettando una tua decisione.</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {([['total', 'Persone'], ['registered', 'Wannabe'], ['in_path', 'In percorso'], ['ready', 'Ready']] as const).map(([k, label]) => (
          <div key={k} className="rounded-2xl border border-line bg-card px-4 py-3">
            <dt className="text-xs font-medium text-ink-soft">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{board.counts[k] ?? 0}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <Tile title="Nuove candidature" hint="In attesa di colloquio o della tua decisione" empty="Nessuna nuova candidatura." items={board.registered} flagAfter={WAIT_FLAG_DAYS} onOpen={setOpenPerson} />
        <Tile title="Colloqui in calendario" hint="Già fissati, dal più vicino" empty="Nessun colloquio fissato." items={board.interviews} tone="ok" onOpen={setOpenPerson} />
        <Tile title="Promemoria" hint="Cose da fare o da inviare, dalla più urgente" empty="Nessun promemoria aperto." items={board.memos} onOpen={setOpenPerson} />
        <Tile title="Pronti per Ready" hint="Percorso completato, manca la tua conferma" empty="Nessuno in coda." items={board.readyQueue} flagAfter={WAIT_FLAG_DAYS} tone="ok" onOpen={setOpenPerson} />
        <Tile title="In percorso" hint="Con il passo aperto" empty="Nessuno in percorso." items={board.inPath} onOpen={setOpenPerson} />
        <Tile title={`Scadenze entro ${EXPIRY_DAYS} giorni`} hint="Titoli, documenti e assicurazioni, compresi quelli già scaduti" empty="Nessuna scadenza in arrivo." items={board.expiring} onOpen={setOpenPerson} />
        <Tile title="Titoli da verificare" hint="Dichiarati, in attesa di controllo" empty="Nessun titolo da verificare." items={board.titles} onOpen={setOpenPerson} />
      </div>
      {!demo && <InterviewSettings />}
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
                  <span className="block truncate text-xs text-ink-soft first-letter:uppercase">{i.detail}</span>
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
