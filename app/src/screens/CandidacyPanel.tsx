import { useCallback, useEffect, useState } from 'react'
import { Button, Chip, Row } from '../components/ui'
import {
  type Candidacy, type InterviewRequest, type PersonExtra, CONTACT, COOKING, DURATIONS, MODALITY, SKILL_LEVELS, fmtSlot, loadCandidacy, romeInstant, trackLabel,
} from '../lib/application'
import { friendly, say } from '../lib/friendly'
import { supabase } from '../lib/supabase'
import { addNote } from './PersonNotes'

const input = 'h-11 w-full rounded-xl border border-line bg-card px-3 text-base'
const statusText: Record<string, string> = { pending: 'Da fissare', scheduled: 'Fissato', completed: 'Fatto', cancelled: 'Annullato' }
/** "2026-11-19T17:30" scritto dall'amministratore vale come orario italiano. */
const fromLocalInput = (v: string) => { const [d, t] = v.split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return romeInstant(y, m, dd, h, mi).toISOString() }

/** Nella scheda della persona: le risposte della candidatura e la gestione del colloquio conoscitivo. */
export default function CandidacyPanel({ personId, onChanged }: { personId: string; onChanged: () => void }) {
  const [data, setData] = useState<{ candidacy: Candidacy | null; interview: InterviewRequest | null; extra: PersonExtra | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [when, setWhen] = useState(''); const [custom, setCustom] = useState('')
  const [duration, setDuration] = useState(30); const [modality, setModality] = useState('whatsapp')
  const [location, setLocation] = useState(''); const [message, setMessage] = useState(''); const [notes, setNotes] = useState('')

  const reload = useCallback(() => loadCandidacy(personId).then((d) => {
    setData(d)
    if (d.interview) { setModality(d.interview.modality ?? d.interview.contact_preference); setDuration(d.interview.duration_minutes ?? 30); setLocation(d.interview.location ?? ''); setMessage(d.interview.candidate_message ?? '') }
  }).catch((e) => setError(friendly(e, 'leggere la candidatura'))), [personId])
  useEffect(() => { void reload() }, [reload])

  const run = async (done: string, call: PromiseLike<{ error: unknown }>) => {
    setBusy(true); setError(null)
    const { error } = await call
    if (error) setError(friendly(error, 'completare l\'operazione')); else { say(done); setPlanning(false); setWhen(''); setCustom('') }
    await reload(); onChanged(); setBusy(false)
  }

  if (!data) return error ? <p role="alert" className="rounded-2xl bg-bad-soft p-4 text-sm text-bad">{error}</p> : null
  const { candidacy: c, interview: iv, extra } = data
  if (!c && !iv) return null
  const chosen = custom ? fromLocalInput(custom) : when

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="text-base font-semibold">Candidatura e colloquio</h2>
      {error && <p role="alert" className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      {iv && (
        <div className="mt-3 rounded-xl bg-sand p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Colloquio conoscitivo</p>
            <Chip tone={iv.status === 'scheduled' ? 'sea' : iv.status === 'completed' ? 'ok' : 'warn'}>{statusText[iv.status]}</Chip>
          </div>
          <p className="mt-1 text-sm text-ink-soft">Preferisce essere contattato con: <span className="font-medium text-ink">{CONTACT[iv.contact_preference as keyof typeof CONTACT] ?? iv.contact_preference}</span></p>
          {iv.status === 'scheduled' && iv.scheduled_start && (
            <p className="mt-1 text-sm">Fissato per <span className="font-semibold capitalize">{fmtSlot(iv.scheduled_start)}</span> · {iv.duration_minutes} minuti · {MODALITY[iv.modality as keyof typeof MODALITY] ?? iv.modality}{iv.location ? ` · ${iv.location}` : ''}</p>
          )}
          {iv.status === 'completed' && iv.scheduled_start && <p className="mt-1 text-sm">Fatto il <span className="capitalize">{fmtSlot(iv.scheduled_start)}</span>.</p>}
          {iv.admin_notes && <p className="mt-1 text-sm text-ink-soft">Tue note: {iv.admin_notes}</p>}

          {iv.status !== 'completed' && (planning || iv.status === 'pending') && (
            <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); void run('Colloquio fissato', supabase.rpc('cmd_schedule_interview', { p_request: iv.id, p_start: chosen, p_duration: duration, p_modality: modality, p_location: location || null, p_message: message || null })) }}>
              <fieldset>
                <legend className="mb-1 text-sm font-medium text-ink-soft">Date proposte dal candidato: tocca quella che accetti</legend>
                <div className="flex flex-wrap gap-2">
                  {iv.preferred_slots.map((s) => {
                    const past = new Date(s) < new Date()
                    return <button key={s} type="button" disabled={past} aria-pressed={!custom && when === s} onClick={() => { setWhen(s); setCustom('') }} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium capitalize disabled:opacity-40 ${!custom && when === s ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{fmtSlot(s)}{past ? ' · passata' : ''}</button>
                  })}
                </div>
              </fieldset>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink-soft">Oppure un'altra data (orario italiano)</span>
                <input type="datetime-local" step={300} className={input} value={custom} onChange={(e) => setCustom(e.target.value)} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Durata</span>
                  <select className={input} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{DURATIONS.map((d) => <option key={d} value={d}>{d} minuti</option>)}</select></label>
                <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Modalità</span>
                  <select className={input} value={modality} onChange={(e) => setModality(e.target.value)}>{Object.entries(MODALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              </div>
              <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Luogo o link (facoltativo)</span>
                <input className={input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Es. link di Google Meet" /></label>
              <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Messaggio per il candidato (facoltativo, lo legge in Today)</span>
                <textarea rows={2} className="w-full rounded-xl border border-line bg-card p-3 text-base" value={message} onChange={(e) => setMessage(e.target.value)} /></label>
              {!chosen && <p className="text-sm text-warn">Scegli una data proposta oppure scrivine un'altra.</p>}
              <Button type="submit" disabled={busy || !chosen}>{busy ? 'Salvo…' : iv.status === 'scheduled' ? 'Sposta il colloquio' : 'Fissa il colloquio'}</Button>
              {planning && <Button type="button" variant="ghost" onClick={() => setPlanning(false)}>Annulla</Button>}
              <p className="text-xs text-ink-soft">Il candidato vede data e messaggio nella sua pagina Today. L'email di conferma partirà quando il modello sarà approvato.</p>
            </form>
          )}
          {iv.status === 'scheduled' && !planning && (
            <div className="mt-3 space-y-2">
              <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Note sul colloquio (restano nel suo profilo, le leggi solo tu)</span>
                <textarea rows={2} className="w-full rounded-xl border border-line bg-card p-3 text-base" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
              <Button disabled={busy} onClick={() => { const n = notes.trim(); void run('Colloquio segnato come fatto', supabase.rpc('cmd_complete_interview', { p_request: iv.id, p_notes: n || null }).then(async (r) => { if (!r.error && n) await addNote(personId, 'interview', n).catch(() => undefined); return r })) }}>Segna il colloquio come fatto</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" disabled={busy} onClick={() => setPlanning(true)}>Sposta</Button>
                <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm('Annullare il colloquio fissato? La richiesta torna tra quelle da fissare.')) void run('Colloquio annullato', supabase.rpc('cmd_cancel_interview', { p_request: iv.id, p_reason: notes || null })) }}>Annulla il colloquio</Button>
              </div>
            </div>
          )}
          {iv.status === 'completed' && <p className="mt-2 text-sm text-ink-soft">Ora puoi accettare o non accettare la candidatura con i comandi in alto, scrivendo la nota sulla decisione.</p>}
        </div>
      )}

      {c && (
        <div className="mt-3 divide-y divide-line">
          <Row label="Si candida come" value={trackLabel[c.track] ?? c.track} />
          {extra && <Row label="Sesso" value={extra.gender} />}
          {extra && <Row label="Residenza" value={[extra.address, extra.city].filter(Boolean).join(', ')} />}
          {extra && <Row label="Lingua madre" value={extra.mother_tongue} />}
          <Row label="Anni di esperienza" value={c.experience_years ?? 'Non indicati'} />
          {c.track !== 'crew' && <Row label="Titolo di comando" value={c.command_title ?? 'Nessuno'} />}
          {c.experience_contexts.length > 0 && <Row label="Dove ha maturato esperienza" value={c.experience_contexts.join(', ')} />}
          {c.boat_types.length > 0 && <Row label="Tipi di barca" value={c.boat_types.join(', ')} />}
          {c.skills.length > 0 && <Row label="Competenze" value={c.skills.map((s) => `${s.name} (${SKILL_LEVELS[s.level as keyof typeof SKILL_LEVELS] ?? s.level})`).join(', ')} />}
          {c.cooking_level && <Row label="Cucina" value={`${COOKING[c.cooking_level as keyof typeof COOKING] ?? c.cooking_level}${c.cooking_type ? ` · ${c.cooking_type}` : ''}`} />}
          <div className="py-2 text-sm">
            <p className="text-ink-soft">Raccontaci di te</p>
            <p className="mt-1 whitespace-pre-wrap">{c.about_me}</p>
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-soft">Lingue e certificazioni dichiarate sono qui sotto, nel suo My Deck.</p>
    </section>
  )
}
