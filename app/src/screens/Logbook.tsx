import { useEffect, useState } from 'react'
import { Button, Empty } from '../components/ui'
import { addRow, deleteRow, updateRow } from '../lib/deck'
import { friendly, say } from '../lib/friendly'
import { fmtDate, sourceLabel } from '../lib/labels'
import { loadLists, pick } from '../lib/lists'
import { type ImportResult, checkEntry, downloadTemplate, overlaps, readSeasonFile, roleFromLabel, spanDays } from '../lib/logbook'
import type { Deck, LogEntry } from '../lib/types'
import { ConfirmLink, MiniForm, dateLimits, num, str } from './DeckForms'
import type { FieldSpec } from './DeckForms'

type Vals = Record<string, string | boolean>
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('it-IT')

/** Il logbook: totali, navigazioni una per una, aggiunta a mano e caricamento del file della stagione. */
export default function Logbook({ deck, readOnly, admin, onChanged }: { deck: Deck; readOnly: boolean; admin: boolean; onChanged: () => void }) {
  const { person, logbook } = deck
  const canLog = person.status === 'in_path' || person.status === 'ready' || admin
  const [roles, setRoles] = useState<string[]>([])
  const [more, setMore] = useState(false)
  useEffect(() => { loadLists().then((l) => setRoles(pick(l, 'logbook_role').map((o) => o.label))).catch(() => setRoles([])) }, [])

  const fields = (e?: LogEntry): FieldSpec[] => [
    { name: 'from_date', label: 'Dal', type: 'date', required: true, initial: e?.from_date ?? '', ...dateLimits.past },
    { name: 'to_date', label: 'Al', type: 'date', required: true, initial: e?.to_date ?? '', ...dateLimits.past },
    { name: 'route', label: 'Zona di navigazione o rotta', required: true, placeholder: 'Per esempio: Cicladi, oppure Olbia – Bonifacio – Olbia', initial: e?.route ?? '' },
    { name: 'role_label', label: 'Il tuo ruolo a bordo', type: 'select', required: true, options: [...new Set([...(e?.role_label ? [e.role_label] : []), ...roles])].map((x) => ({ value: x, label: x })), initial: e?.role_label ?? '' },
    { name: 'miles', label: 'Miglia', type: 'number', required: true, initial: e?.miles != null ? String(e.miles) : '' },
    { name: 'days', label: 'Giorni in mare', type: 'number', required: true, initial: e?.days != null ? String(e.days) : '' },
    { name: 'nights', label: 'Notti in mare (facoltativo)', type: 'number', initial: e?.nights != null ? String(e.nights) : '' },
    { name: 'boat_model', label: 'Modello della barca (facoltativo)', placeholder: 'Per esempio: Bavaria 46 Cruiser', initial: e?.boat_model ?? '' },
    { name: 'boat_name', label: 'Nome della barca (facoltativo)', initial: e?.boat_name ?? '' },
    { name: 'loa_m', label: 'Lunghezza LOA in metri (facoltativo)', type: 'number', initial: e?.loa_m != null ? String(e.loa_m) : '' },
    { name: 'propulsion', label: 'Vela o motore', type: 'select', options: [{ value: 'sail', label: 'Vela' }, { value: 'power', label: 'Motore' }], initial: e?.propulsion ?? '' },
    { name: 'night_hours', label: 'Ore notturne (facoltativo)', type: 'number', initial: e?.night_hours != null ? String(e.night_hours) : '' },
    { name: 'night_miles', label: 'Miglia notturne (facoltativo)', type: 'number', initial: e?.night_miles != null ? String(e.night_miles) : '' },
    { name: 'is_tidal', label: 'Navigazione in acque con marea (tidal)', type: 'checkbox', initial: e?.is_tidal ?? false },
    { name: 'notes', label: 'Note (facoltativo)', initial: e?.notes ?? '' },
  ]
  /** Prepara la riga e dice con parole semplici cosa non torna, compresa la sovrapposizione con altre navigazioni. */
  const toRow = (v: Vals, selfId?: string) => {
    const from = str(v.from_date)!, to = str(v.to_date)!
    const row = {
      from_date: from, to_date: to, route: str(v.route), miles: num(v.miles), days: num(v.days), nights: num(v.nights),
      boat_model: str(v.boat_model), boat_name: str(v.boat_name), loa_m: num(v.loa_m), propulsion: str(v.propulsion),
      night_hours: num(v.night_hours), night_miles: num(v.night_miles), is_tidal: !!v.is_tidal, notes: str(v.notes),
      role_label: str(v.role_label), role_on_board: roleFromLabel(str(v.role_label)),
    }
    const problems = checkEntry(row)
    if (problems.length) throw new Error(`Controlla: ${problems.join('; ')}.`)
    const hit = logbook.find((e) => e.id !== selfId && overlaps(e, row))
    if (hit) throw new Error(`Queste date si sovrappongono a un'altra navigazione del logbook (${hit.route ?? 'senza nome'}, dal ${fmtDate(hit.from_date)} al ${fmtDate(hit.to_date)}). Correggi le date di una delle due.`)
    return row
  }
  const warn = (v: Vals) => {
    const from = str(v.from_date), to = str(v.to_date)
    if (!from || !to || to < from) return null
    const span = spanDays(from, to)
    return span > 60 ? `Questa navigazione dura ${span} giorni: se è giusto così, salva pure.` : null
  }

  const t = logbook.reduce((a, e) => ({
    miles: a.miles + Number(e.miles ?? 0), days: a.days + (e.days ?? 0), nights: a.nights + (e.nights ?? 0),
    skipper: a.skipper + (e.role_on_board === 'skipper' || e.role_on_board === 'fleet_leader' ? Number(e.miles ?? 0) : 0),
  }), { miles: 0, days: 0, nights: 0, skipper: 0 })
  const shown = more ? logbook : logbook.slice(0, 8)

  return (
    <>
      {logbook.length > 0 && (
        <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[['Miglia', n1(t.miles)], ['Giorni in mare', String(t.days)], ['Notti', String(t.nights)], ['Miglia da skipper', n1(t.skipper)]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-sand px-3 py-2"><dt className="text-xs text-ink-soft">{k}</dt><dd className="text-lg font-semibold tabular-nums">{v}</dd></div>
          ))}
        </dl>
      )}
      {logbook.length === 0 ? <Empty>{canLog ? 'Registra qui le tue navigazioni, una alla volta oppure caricando il file della stagione. Restano tue per sempre.' : 'Il logbook si apre quando la tua candidatura viene accettata.'}</Empty> : (
        <ul className="divide-y divide-line">
          {shown.map((e) => (
            <li key={e.id} className="py-2.5">
              <p className="text-sm font-medium">{e.route ?? 'Navigazione'}</p>
              <p className="text-xs text-ink-soft">{fmtDate(e.from_date)}{e.to_date !== e.from_date ? ` – ${fmtDate(e.to_date)}` : ''} · {e.miles ?? 0} miglia{e.days != null ? ` · ${e.days} giorni` : ''}{e.role_label ? ` · ${e.role_label}` : ''}</p>
              <p className="text-xs text-ink-soft">{[e.boat_model ?? e.boat_type, e.boat_name, e.loa_m ? `${e.loa_m} m` : null, e.propulsion === 'sail' ? 'vela' : e.propulsion === 'power' ? 'motore' : null, e.is_tidal ? 'tidal' : null, sourceLabel[e.source]].filter(Boolean).join(' · ')}</p>
              {!readOnly && e.source !== 'generated' && (admin || e.source === 'declared') && (
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <MiniForm small open="Modifica" warn={warn} fields={fields(e)} onSave={async (v) => { await updateRow('logbook_entry', e.id, toRow(v, e.id)); onChanged() }} />
                  {admin && <ConfirmLink label="Elimina" question="La cancello davvero? Non si può ripristinare." yes="Sì, elimina" onConfirm={async () => { await deleteRow('logbook_entry', e.id); onChanged() }} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {logbook.length > 8 && <button type="button" className="mt-2 text-sm font-semibold text-sea" onClick={() => setMore(!more)}>{more ? 'Mostra solo le ultime' : `Mostra tutte le ${logbook.length} navigazioni`}</button>}
      {canLog && !readOnly && (
        <>
          <MiniForm open="Aggiungi una navigazione" submit="Aggiungi" done="Navigazione aggiunta" warn={warn} fields={fields()}
            onSave={async (v) => { await addRow('logbook_entry', { person_id: person.id, source: 'declared', ...toRow(v) }); onChanged() }} />
          <SeasonImport personId={person.id} existing={logbook} onChanged={onChanged} />
        </>
      )}
    </>
  )
}

/** Carica il file della stagione: prima fa vedere cosa entrerà e cosa no, poi importa solo le righe buone. */
function SeasonImport({ personId, existing, onChanged }: { personId: string; existing: LogEntry[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  if (!open) return <Button variant="ghost" className="mt-3" onClick={() => { setOpen(true); setResult(null); setError(null) }}>Carica il file della stagione</Button>

  const good = result?.rows.filter((r) => r.row) ?? []
  const bad = result?.rows.filter((r) => r.problems.length) ?? []
  const dup = result?.rows.filter((r) => r.overlap) ?? []
  const run = async () => {
    setBusy(true); setError(null)
    try {
      await addRow('logbook_entry', good.map((r) => ({ person_id: personId, ...r.row })))
      say(`${good.length} ${good.length === 1 ? 'navigazione aggiunta' : 'navigazioni aggiunte'} al logbook`)
      setOpen(false); onChanged()
    } catch (e) { setError(friendly(e, 'aggiungere le navigazioni')) } finally { setBusy(false) }
  }
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-sand p-3">
      <p className="text-sm font-semibold">Carica il file della stagione</p>
      <p className="text-sm text-ink-soft">Un file CSV con una riga per navigazione. Se usi Excel o Numbers, esporta il foglio in formato CSV. <button type="button" className="font-semibold text-sea" onClick={downloadTemplate}>Scarica il modello</button></p>
      <input type="file" accept=".csv,text/csv" aria-label="File della stagione"
        onChange={(e) => { const f = e.target.files?.[0]; setResult(null); setError(null); if (f) readSeasonFile(f, existing).then(setResult).catch(() => setError('Non siamo riusciti a leggere il file: controlla che sia un CSV e riprova.')) }}
        className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:text-sm file:font-semibold file:text-white" />
      {result?.fileProblem && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{result.fileProblem}</p>}
      {result && !result.fileProblem && (
        <>
          <p className="text-sm"><span className="font-semibold text-ok">{good.length} pronte da aggiungere</span>{bad.length > 0 && <span className="text-bad"> · {bad.length} da correggere</span>}{dup.length > 0 && <span className="text-warn"> · {dup.length} sovrapposte, saltate</span>}</p>
          {good.length > 0 && (
            <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg bg-card px-3 text-sm">
              {good.map((r) => <li key={r.line} className="py-1.5">{r.label} · {String(r.row!.miles)} miglia · {String(r.row!.days)} giorni</li>)}
            </ul>
          )}
          {(bad.length > 0 || dup.length > 0) && (
            <ul className="space-y-1.5 text-sm">
              {bad.map((r) => <li key={r.line} className="rounded-lg bg-bad-soft px-3 py-2 text-bad"><span className="font-semibold">Riga {r.line}</span> ({r.label}): {r.problems.join('; ')}.</li>)}
              {dup.map((r) => <li key={r.line} className="rounded-lg bg-warn-soft px-3 py-2 text-warn"><span className="font-semibold">Riga {r.line}</span> ({r.label}): {r.overlap}.</li>)}
            </ul>
          )}
          {bad.length > 0 && <p className="text-xs text-ink-soft">Puoi aggiungere subito le righe pronte e ricaricare più tardi il file corretto: quelle già entrate verranno riconosciute e saltate.</p>}
        </>
      )}
      {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Chiudi</Button>
        <Button type="button" disabled={busy || good.length === 0} onClick={() => void run()}>{busy ? 'Aggiungo…' : good.length ? `Aggiungi ${good.length} ${good.length === 1 ? 'navigazione' : 'navigazioni'}` : 'Niente da aggiungere'}</Button>
      </div>
    </div>
  )
}
