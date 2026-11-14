import { useCallback, useEffect, useState } from 'react'
import { Button, Chip } from '../components/ui'
import { APP_VERSION } from '../lib/errors'
import { friendly, say } from '../lib/friendly'
import { supabase } from '../lib/supabase'

interface Check { area: string; code: string; title: string; level: 'ok' | 'info' | 'warn' | 'bad'; found: number; detail: string | null; advice: string }
interface Run { id: string; at: string; bad: number; warn: number }
interface AppError { id: string; at: string; source: string; message: string; shown: string | null; code: string | null; page: string | null; app_version: string | null; device: string | null; resolved_at: string | null; person: { first_name: string; last_name: string } | null }
interface Action { id: string; at: string; action: string; target_table: string | null; actor: { first_name: string; last_name: string } | null }

const when = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const levelTone = { ok: 'ok', info: 'neutral', warn: 'warn', bad: 'bad' } as const
const levelText = { ok: 'A posto', info: 'Da sapere', warn: 'Da guardare', bad: 'Da sistemare' }
const order = { bad: 0, warn: 1, info: 2, ok: 3 }

/** Area Sistema: il controllo di salute (sicurezza, dati, funzionamento), il registro degli errori e il registro delle azioni. */
export default function System() {
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [errors, setErrors] = useState<AppError[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [busy, setBusy] = useState(false); const [problem, setProblem] = useState<string | null>(null)
  const [showOk, setShowOk] = useState(false); const [showClosed, setShowClosed] = useState(false)

  const loadLogs = useCallback(async () => {
    const [r, e, a] = await Promise.all([
      supabase.from('health_run').select('id, at, bad, warn').order('at', { ascending: false }).limit(8),
      supabase.from('app_error').select('id, at, source, message, shown, code, page, app_version, device, resolved_at, person(first_name, last_name)').order('at', { ascending: false }).limit(100),
      supabase.from('action_log').select('id, at, action, target_table, actor:person!action_log_actor_person_id_fkey(first_name, last_name)').order('at', { ascending: false }).limit(40),
    ])
    const bad = r.error ?? e.error ?? a.error
    if (bad) { setProblem(friendly(bad, 'leggere i registri')); return }
    setRuns((r.data ?? []) as Run[]); setErrors((e.data ?? []) as unknown as AppError[]); setActions((a.data ?? []) as unknown as Action[])
  }, [])
  const run = useCallback(async (save: boolean) => {
    setBusy(true); setProblem(null)
    if (save) { const { error } = await supabase.rpc('cmd_run_health'); if (error) { setProblem(friendly(error, 'eseguire il controllo')); setBusy(false); return } }
    const { data, error } = await supabase.rpc('system_health')
    if (error) setProblem(friendly(error, 'eseguire il controllo')); else { setChecks(data as Check[]); if (save) say('Controllo eseguito e salvato nello storico') }
    await loadLogs(); setBusy(false)
  }, [loadLogs])
  useEffect(() => { void run(false) }, [run])

  const bad = checks?.filter((c) => c.level === 'bad').length ?? 0
  const warn = checks?.filter((c) => c.level === 'warn').length ?? 0
  const visible = (checks ?? []).filter((c) => showOk || c.level !== 'ok').sort((a, b) => order[a.level] - order[b.level])
  const areas = [...new Set((checks ?? []).map((c) => c.area))]
  const openErrors = errors.filter((e) => !e.resolved_at)
  const closeError = async (id: string) => {
    const { error } = await supabase.from('app_error').update({ resolved_at: new Date().toISOString() }).eq('id', id)
    if (error) setProblem(friendly(error)); else { say('Errore segnato come risolto'); await loadLogs() }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sistema</h1>
        <p className="mt-1 text-sm text-ink-soft">Salute dell'applicazione e dei dati. Versione pubblicata: {APP_VERSION}</p>
      </div>
      {problem && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{problem}</p>}

      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Controllo di salute</h2>
            <p className="text-sm text-ink-soft">{checks ? `${checks.length} verifiche su sicurezza, persone, percorso, documenti, dati e funzionamento.` : 'Eseguo le verifiche…'}</p>
          </div>
          <div className="w-56"><Button disabled={busy} onClick={() => void run(true)}>{busy ? 'Controllo…' : 'Esegui e salva nello storico'}</Button></div>
        </div>
        {checks && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {bad === 0 && warn === 0 ? <Chip tone="ok">Tutto a posto</Chip> : <>{bad > 0 && <Chip tone="bad">{bad} da sistemare</Chip>}{warn > 0 && <Chip tone="warn">{warn} da guardare</Chip>}</>}
              <button type="button" className="text-sm font-semibold text-sea" onClick={() => setShowOk(!showOk)}>{showOk ? 'Nascondi le verifiche a posto' : `Mostra anche le ${checks.filter((c) => c.level === 'ok').length} a posto`}</button>
            </div>
            {areas.map((area) => {
              const rows = visible.filter((c) => c.area === area)
              if (!rows.length) return null
              return (
                <div key={area} className="mt-4">
                  <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{area}</h3>
                  <ul className="mt-1 divide-y divide-line">
                    {rows.map((c) => (
                      <li key={c.code} className="flex items-start justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{c.title}{c.level !== 'ok' && <span className="font-semibold tabular-nums"> · {c.found}</span>}</span>
                          {c.level !== 'ok' && <span className="block text-xs text-ink-soft">{c.detail ? `${c.detail}. ` : ''}{c.advice}</span>}
                        </span>
                        <Chip tone={levelTone[c.level]}>{levelText[c.level]}</Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            {runs.length > 0 && <p className="mt-4 text-xs text-ink-soft">Storico: {runs.map((r) => `${when(r.at)} (${r.bad} da sistemare, ${r.warn} da guardare)`).join(' · ')}</p>}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Registro degli errori <span className="font-normal text-ink-soft">· {openErrors.length} aperti</span></h2>
          <button type="button" className="text-sm font-semibold text-sea" onClick={() => setShowClosed(!showClosed)}>{showClosed ? 'Solo gli aperti' : 'Mostra anche i risolti'}</button>
        </div>
        <p className="text-sm text-ink-soft">Quello che è andato storto agli utenti, registrato da solo: cosa hanno visto, in quale pagina e con quale versione.</p>
        {(showClosed ? errors : openErrors).length === 0 ? <p className="mt-3 text-sm text-ink-soft">Nessun errore registrato.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {(showClosed ? errors : openErrors).map((e) => (
              <li key={e.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <Chip tone={e.resolved_at ? 'ok' : e.source === 'schermata' ? 'bad' : 'warn'}>{e.resolved_at ? 'Risolto' : e.source}</Chip>
                  <span>{when(e.at)}</span><span>{e.person ? `${e.person.first_name} ${e.person.last_name}` : 'Visitatore senza accesso'}</span>{e.page && <span>pagina {e.page}</span>}
                </div>
                {e.shown && <p className="mt-1 text-sm">Ha visto: «{e.shown}»</p>}
                <p className="mt-1 font-mono text-xs break-words text-ink-soft">{e.code ? `[${e.code}] ` : ''}{e.message}</p>
                <p className="text-xs text-ink-soft">{[e.app_version && `versione ${e.app_version}`, e.device].filter(Boolean).join(' · ')}</p>
                {!e.resolved_at && <button type="button" className="mt-1 text-xs font-semibold text-sea" onClick={() => void closeError(e.id)}>Segna come risolto</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="text-base font-semibold">Registro delle azioni <span className="font-normal text-ink-soft">· le ultime 40</span></h2>
        {actions.length === 0 ? <p className="mt-3 text-sm text-ink-soft">Ancora nessuna azione registrata.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {actions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 text-sm">
                <span><span className="font-medium">{a.actor ? `${a.actor.first_name} ${a.actor.last_name}` : 'Sistema'}</span> · {a.action}{a.target_table ? ` · ${a.target_table}` : ''}</span>
                <span className="text-xs text-ink-soft">{when(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
