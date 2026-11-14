import { useCallback, useEffect, useState } from 'react'
import { Button, Chip } from '../components/ui'
import { loadDeck } from '../lib/deck'
import { capabilityLabel, statusLabel, stepLabel, stepStatusLabel } from '../lib/labels'
import { supabase } from '../lib/supabase'
import type { Deck, Step } from '../lib/types'
import MyDeck from './MyDeck'

const goalsByFamily: Record<string, string[]> = {
  skipper: ['skipper_fleet', 'skipper_charter', 'co_skipper'],
  crew_staff: ['hospitality'],
}
const templates = [
  { id: 'full', label: 'Percorso completo', hint: 'Test, Career e documenti' },
  { id: 'career_and_documents', label: 'Senza test', hint: 'Career e documenti' },
] as const

/** Scheda della persona vista dall'amministratore: i comandi in alto, sotto il suo My Deck in sola lettura. */
export default function PersonSheet({ personId, onBack }: { personId: string; onBack: () => void }) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [goal, setGoal] = useState('')
  const [template, setTemplate] = useState<(typeof templates)[number]['id']>('full')
  const [ask, setAsk] = useState<null | { title: string; run: (reason: string) => PromiseLike<{ error: { message: string } | null }> }>(null)
  const [reason, setReason] = useState('')

  const reload = useCallback(() => loadDeck(personId).then(setDeck).catch((e) => setMsg({ text: e?.message ?? 'Errore', bad: true })), [personId])
  useEffect(() => { void reload() }, [reload])

  const run = async (label: string, call: PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true); setMsg(null)
    const { error } = await call
    setMsg(error ? { text: error.message, bad: true } : { text: label })
    await reload(); setBusy(false)
  }

  if (!deck) return <p className="text-sm text-ink-soft">{msg?.text ?? 'Carico…'}</p>
  const { person } = deck
  const goals = goalsByFamily[person.family] ?? []
  const chosenGoal = goal || goals[0]
  const plan = deck.plans.find((p) => p.status === 'active')
  const working = plan?.steps.filter((s) => s.kind !== 'ready_confirmation' && s.status !== 'not_required') ?? []
  const allDone = !!plan && working.every((s) => s.status === 'done')
  const declared = deck.titles.filter((t) => t.status === 'declared')

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="text-sm font-medium text-sea">‹ Sala di controllo</button>

      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{person.first_name} {person.last_name}</h1>
          <Chip tone={person.status === 'ready' ? 'ok' : person.status === 'in_path' ? 'sea' : 'neutral'}>{statusLabel[person.status]}</Chip>
        </div>
        {msg && <p role="status" className={`mt-2 rounded-lg px-3 py-2 text-sm ${msg.bad ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok'}`}>{msg.text}</p>}

        {ask && (
          <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); const a = ask; setAsk(null); void run('Fatto.', a.run(reason)); setReason('') }}>
            <label className="block text-sm font-medium">{ask.title}
              <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-line p-3 text-base font-normal" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => setAsk(null)}>Annulla</Button>
              <Button type="submit" disabled={busy}>Conferma</Button>
            </div>
          </form>
        )}

        {!ask && person.status === 'registered' && (
          <div className="mt-3 space-y-3">
            <fieldset>
              <legend className="text-sm font-medium text-ink-soft">Obiettivo del percorso</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {goals.map((g) => <Pick key={g} on={chosenGoal === g} onClick={() => setGoal(g)}>{capabilityLabel[g]}</Pick>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium text-ink-soft">Piano</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {templates.map((t) => <Pick key={t.id} on={template === t.id} onClick={() => setTemplate(t.id)}>{t.label} · {t.hint}</Pick>)}
              </div>
            </fieldset>
            <Button disabled={busy || !chosenGoal} onClick={() => void run('Candidatura accettata: ora è In percorso.', supabase.rpc('cmd_accept_application', { p_person: person.id, p_goal: chosenGoal, p_template: template }))}>Accetta la candidatura</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setAsk({ title: 'Motivo (resta solo a te)', run: (r) => supabase.rpc('cmd_reject_application', { p_person: person.id, p_reason: r }) })}>Non accettare</Button>
          </div>
        )}

        {!ask && person.status !== 'registered' && plan && (
          <div className="mt-3">
            <p className="text-sm text-ink-soft">Percorso verso <span className="font-medium text-ink">{capabilityLabel[plan.goal_capability] ?? plan.goal_capability}</span></p>
            <ul className="mt-1 divide-y divide-line">
              {working.map((s) => <StepRow key={s.kind} s={s} busy={busy} onSet={(st) => void run(`${stepLabel[s.kind]}: ${stepStatusLabel[st].toLowerCase()}.`, supabase.rpc('cmd_update_step', { p_step: s.id, p_status: st }))} />)}
            </ul>
            <Button className="mt-3" disabled={busy || !allDone} onClick={() => void run('Confermato: ora è Ready.', supabase.rpc('cmd_confirm_ready', { p_plan: plan.id }))}>
              {allDone ? 'Conferma Ready' : 'Conferma Ready · mancano dei passi'}
            </Button>
          </div>
        )}

        {!ask && declared.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-ink-soft">Titoli da verificare</p>
            <ul className="mt-1 divide-y divide-line">
              {declared.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0 text-sm font-medium">{t.name_it}{!t.has_file && <span className="font-normal text-warn"> · senza file</span>}</span>
                  <span className="flex gap-2">
                    <Small disabled={busy} onClick={() => setAsk({ title: `Perché rifiuti "${t.name_it}"? (lo legge la persona)`, run: (r) => supabase.rpc('cmd_reject_title', { p_title: t.id, p_reason: r }) })}>Rifiuta</Small>
                    <Small primary disabled={busy} onClick={() => void run('Titolo verificato.', supabase.rpc('cmd_verify_title', { p_title: t.id }))}>Verifica</Small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="px-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">Il suo My Deck, in sola lettura</p>
      <MyDeck deck={deck} readOnly onChanged={() => {}} />
    </div>
  )
}

function Pick({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-11 rounded-xl border px-3 text-sm font-medium ${on ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{children}</button>
}
function Small({ primary, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" {...rest} className={`h-10 rounded-lg px-3 text-sm font-semibold disabled:opacity-50 ${primary ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{children}</button>
}
function StepRow({ s, busy, onSet }: { s: Step; busy: boolean; onSet: (st: 'in_progress' | 'done' | 'todo') => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <span className="text-sm font-medium">{stepLabel[s.kind]} <span className="font-normal text-ink-soft">· {stepStatusLabel[s.status]}</span></span>
      <span className="flex gap-2">
        {s.status === 'todo' && <Small disabled={busy} onClick={() => onSet('in_progress')}>Avvia</Small>}
        {s.status !== 'done' && <Small primary disabled={busy} onClick={() => onSet('done')}>Segna fatto</Small>}
        {s.status === 'done' && <Small disabled={busy} onClick={() => onSet('in_progress')}>Riapri</Small>}
      </span>
    </li>
  )
}
