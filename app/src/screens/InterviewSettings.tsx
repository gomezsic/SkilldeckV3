import { useEffect, useState } from 'react'
import { Button } from '../components/ui'
import { type SlotSettings, DEFAULT_SETTINGS, WEEKDAYS, freeSlots } from '../lib/application'
import { friendly, say, useUnsaved } from '../lib/friendly'
import { supabase } from '../lib/supabase'

const input = 'h-11 w-full rounded-xl border border-line bg-card px-3 text-base'
/** Le fasce che i candidati possono proporre per il colloquio: l'amministratore le cambia quando vuole. */
export default function InterviewSettings() {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<SlotSettings | null>(null)
  const [s, setS] = useState<SlotSettings>(DEFAULT_SETTINGS)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('interview_settings').select('weekdays, start_time, end_time, slot_minutes, horizon_days').maybeSingle().then(({ data, error }) => {
      if (error || !data) { if (error) setError(friendly(error, 'leggere le fasce dei colloqui')); return }
      const v = { weekdays: data.weekdays, start: data.start_time.slice(0, 5), end: data.end_time.slice(0, 5), slot_minutes: data.slot_minutes, horizon_days: data.horizon_days }
      setSaved(v); setS(v)
    })
  }, [])
  const dirty = !!saved && JSON.stringify(saved) !== JSON.stringify(s)
  useUnsaved(open && dirty)
  const problem = s.weekdays.length === 0 ? 'Scegli almeno un giorno della settimana.' : s.end <= s.start ? 'L\'orario di fine deve venire dopo quello di inizio.' : null
  const perDay = problem ? 0 : (freeSlots({ ...s, weekdays: [1, 2, 3, 4, 5, 6, 7], horizon_days: 1 }, [])[0]?.slots.length ?? 0)

  const save = async () => {
    setBusy(true); setError(null)
    const { error } = await supabase.from('interview_settings').update({ weekdays: [...s.weekdays].sort(), start_time: s.start, end_time: s.end, slot_minutes: s.slot_minutes, horizon_days: s.horizon_days }).eq('id', true)
    if (error) setError(friendly(error, 'salvare le fasce')); else { setSaved(s); say('Fasce dei colloqui salvate') }
    setBusy(false)
  }
  const summary = saved ? `${saved.weekdays.map((d) => WEEKDAYS[d - 1].toLowerCase()).join(', ')} · dalle ${saved.start} alle ${saved.end} · ogni ${saved.slot_minutes} minuti · prossimi ${saved.horizon_days} giorni` : 'Carico…'

  return (
    <section className="mt-3 rounded-2xl border border-line bg-card p-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
        <span><span className="block text-base font-semibold">Fasce dei colloqui</span><span className="block text-xs text-ink-soft">{summary}</span></span>
        <span className="text-sm font-medium text-sea">{open ? 'Chiudi' : 'Modifica'}</span>
      </button>
      {open && (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void save() }}>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink-soft">Giorni in cui fai i colloqui</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((w, i) => {
                const on = s.weekdays.includes(i + 1)
                return <button key={w} type="button" aria-pressed={on} onClick={() => setS({ ...s, weekdays: on ? s.weekdays.filter((d) => d !== i + 1) : [...s.weekdays, i + 1].sort() })} className={`h-11 rounded-xl border px-3 text-sm font-medium ${on ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{w}</button>
              })}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Dalle (ora italiana)</span><input type="time" step={900} className={input} value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Alle</span><input type="time" step={900} className={input} value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Una fascia ogni</span>
              <select className={input} value={s.slot_minutes} onChange={(e) => setS({ ...s, slot_minutes: Number(e.target.value) })}>{[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minuti</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Per i prossimi</span>
              <select className={input} value={s.horizon_days} onChange={(e) => setS({ ...s, horizon_days: Number(e.target.value) })}>{[14, 21, 28, 42, 60, 90].map((m) => <option key={m} value={m}>{m} giorni</option>)}</select></label>
          </div>
          {problem ? <p className="text-sm text-warn">{problem}</p> : <p className="text-sm text-ink-soft">Con queste scelte i candidati vedono {perDay} fasce per ogni giorno, la prima alle {s.start}. Le fasce già occupate da un colloquio fissato non vengono proposte.</p>}
          {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="submit" disabled={busy || !dirty || !!problem}>{busy ? 'Salvo…' : dirty ? 'Salva le fasce' : 'Nessuna modifica da salvare'}</Button>
            <Button type="button" variant="ghost" disabled={!dirty} onClick={() => saved && setS(saved)}>Annulla le modifiche</Button>
          </div>
        </form>
      )}
    </section>
  )
}
