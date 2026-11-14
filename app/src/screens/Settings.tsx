import { useEffect, useState } from 'react'
import { Button } from '../components/ui'
import { friendly, say } from '../lib/friendly'
import { type CatalogItem, type Option, LIST_NAMES, loadCatalog, loadLists } from '../lib/lists'
import { supabase } from '../lib/supabase'

const input = 'h-10 w-full rounded-lg border border-line bg-card px-3 text-sm'
const cell = 'px-3 py-2 align-middle'

/** Impostazioni: gli elenchi che compaiono nelle tendine e nei bottoni, e il catalogo delle certificazioni. */
export default function Settings() {
  const [tab, setTab] = useState<string>('issuer')
  const [options, setOptions] = useState<Option[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = () => loadLists(true).then(setOptions).catch((e) => setError(friendly(e, 'leggere gli elenchi')))
  useEffect(() => { void reload() }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold">Impostazioni</h1>
      <p className="mt-1 text-sm text-ink-soft">Gli elenchi che le persone trovano nelle tendine e nei bottoni. Ogni modifica vale subito in tutta l'applicazione.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Elenchi" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          <button type="button" aria-current={tab === 'catalog' ? 'page' : undefined} onClick={() => setTab('catalog')} className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-semibold ${tab === 'catalog' ? 'bg-ink text-white' : 'bg-card hover:bg-sand'}`}>Catalogo delle certificazioni</button>
          {Object.entries(LIST_NAMES).map(([k, v]) => (
            <button key={k} type="button" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)} className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium ${tab === k ? 'bg-ink text-white' : 'hover:bg-sand'}`}>
              {v.name}<span className="text-xs opacity-70">{options?.filter((o) => o.list === k).length ?? ''}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === 'catalog' ? <CatalogEditor groups={(options ?? []).filter((o) => o.list === 'title_group' && o.is_active).map((o) => o.label)} issuers={(options ?? []).filter((o) => o.list === 'issuer' && o.is_active).map((o) => o.label)} />
            : options ? <ListEditor key={tab} list={tab} rows={options.filter((o) => o.list === tab)} onChanged={reload} /> : <p className="text-sm text-ink-soft">Carico…</p>}
        </div>
      </div>
    </div>
  )
}

function ListEditor({ list, rows, onChanged }: { list: string; rows: Option[]; onChanged: () => Promise<unknown> }) {
  const meta = LIST_NAMES[list]
  const [label, setLabel] = useState(''); const [group, setGroup] = useState('')
  const [edit, setEdit] = useState<Option | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  const groups = [...new Set(rows.map((r) => r.group_label).filter(Boolean))] as string[]

  const run = async (done: string, call: PromiseLike<{ error: unknown }>) => {
    setBusy(true); setError(null)
    const { error } = await call
    if (error) setError(friendly(error, 'salvare l\'elenco').replace('Esiste già una riga uguale', 'Questa voce esiste già nell\'elenco')); else { say(done); setEdit(null) }
    await onChanged(); setBusy(false)
  }
  const add = () => {
    const v = label.trim(); if (!v) return
    if (rows.some((r) => r.label.toLowerCase() === v.toLowerCase())) { setError(`"${v}" è già nell'elenco.`); return }
    void run('Voce aggiunta', supabase.from('option_list').insert({ list, label: v, group_label: meta.grouped ? group.trim() || null : null, sort: (Math.max(0, ...rows.map((r) => r.sort)) + 10) })).then(() => setLabel(''))
  }
  const move = (r: Option, dir: -1 | 1) => {
    const i = rows.indexOf(r); const other = rows[i + dir]; if (!other) return
    void run('Ordine salvato', Promise.all([
      supabase.from('option_list').update({ sort: other.sort === r.sort ? r.sort + dir : other.sort }).eq('id', r.id),
      supabase.from('option_list').update({ sort: r.sort }).eq('id', other.id),
    ]).then((res) => ({ error: res.find((x) => x.error)?.error ?? null })))
  }
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="text-base font-semibold">{meta.name}</h2>
      <p className="text-xs text-ink-soft">Dove compare: {meta.where}. Le voci spente restano in archivio e non vengono più proposte; chi le aveva già scelte le conserva.</p>
      {error && <p role="alert" className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
        <label className="min-w-48 flex-1 text-xs font-medium text-ink-soft">Nuova voce<input className={`${input} mt-1`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} /></label>
        {meta.grouped && <label className="w-56 text-xs font-medium text-ink-soft">Gruppo<input className={`${input} mt-1`} list={`groups-${list}`} value={group} onChange={(e) => setGroup(e.target.value)} /><datalist id={`groups-${list}`}>{groups.map((g) => <option key={g} value={g} />)}</datalist></label>}
        <button type="submit" disabled={busy || !label.trim()} className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50">Aggiungi</button>
      </form>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-ink-soft"><th className={cell}>Voce</th>{meta.grouped && <th className={cell}>Gruppo</th>}<th className={cell}>Stato</th><th className={`${cell} text-right`}>Azioni</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => edit?.id === r.id ? (
              <tr key={r.id} className="bg-sand">
                <td className={cell}><input aria-label="Voce" className={input} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></td>
                {meta.grouped && <td className={cell}><input aria-label="Gruppo" className={input} list={`groups-${list}`} value={edit.group_label ?? ''} onChange={(e) => setEdit({ ...edit, group_label: e.target.value })} /></td>}
                <td className={cell} />
                <td className={`${cell} space-x-3 text-right whitespace-nowrap`}>
                  <button type="button" className="font-semibold text-sea" disabled={busy || !edit.label.trim()} onClick={() => void run('Voce salvata', supabase.from('option_list').update({ label: edit.label.trim(), group_label: meta.grouped ? (edit.group_label ?? '').trim() || null : null }).eq('id', r.id))}>Salva</button>
                  <button type="button" className="text-ink-soft" onClick={() => setEdit(null)}>Annulla</button>
                </td>
              </tr>
            ) : (
              <tr key={r.id} className={r.is_active ? '' : 'text-ink-soft'}>
                <td className={cell}><button type="button" className="text-left font-medium hover:underline" onClick={() => setEdit(r)}>{r.label}</button></td>
                {meta.grouped && <td className={cell}>{r.group_label ?? ''}</td>}
                <td className={cell}><button type="button" disabled={busy} onClick={() => void run(r.is_active ? 'Voce spenta' : 'Voce riaccesa', supabase.from('option_list').update({ is_active: !r.is_active }).eq('id', r.id))} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.is_active ? 'bg-ok-soft text-ok' : 'bg-sand text-ink-soft'}`}>{r.is_active ? 'Attiva' : 'Spenta'}</button></td>
                <td className={`${cell} space-x-3 text-right whitespace-nowrap`}>
                  <button type="button" aria-label={`Sposta su ${r.label}`} disabled={busy || i === 0} className="disabled:opacity-30" onClick={() => move(r, -1)}>↑</button>
                  <button type="button" aria-label={`Sposta giù ${r.label}`} disabled={busy || i === rows.length - 1} className="disabled:opacity-30" onClick={() => move(r, 1)}>↓</button>
                  <button type="button" className="font-semibold text-sea" onClick={() => setEdit(r)}>Modifica</button>
                  <button type="button" className="font-semibold text-bad" disabled={busy} onClick={() => { if (window.confirm(`Eliminare "${r.label}" dall'elenco? Chi l'aveva già scelta la conserva nel proprio profilo. Se vuoi solo non proporla più, usa "Spenta".`)) void run('Voce eliminata', supabase.from('option_list').delete().eq('id', r.id)) }}>Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-4 text-sm text-ink-soft">Elenco vuoto: aggiungi la prima voce.</p>}
      </div>
    </section>
  )
}

const blank = { code: '', name_it: '', issuer: '', group_label: '', description: '', scope: '', validity_years: '', commercial: false, for_skipper: false, for_crew: false }
function CatalogEditor({ groups, issuers }: { groups: string[]; issuers: string[] }) {
  const [rows, setRows] = useState<CatalogItem[] | null>(null)
  const [open, setOpen] = useState<string | null>(null) // id, oppure 'new'
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const reload = () => loadCatalog(true).then(setRows).catch((e) => setError(friendly(e, 'leggere il catalogo')))
  useEffect(() => { void reload() }, [])
  const start = (r?: CatalogItem) => {
    setError(null); setOpen(r ? r.id : 'new')
    setF(r ? { code: r.code, name_it: r.name_it, issuer: r.issuer ?? '', group_label: r.group_label ?? '', description: r.description ?? '', scope: r.scope ?? '', validity_years: r.validity_months ? String(r.validity_months / 12) : '', commercial: r.commercial, for_skipper: r.for_skipper, for_crew: r.for_crew } : blank)
  }
  const save = async () => {
    const years = f.validity_years.trim() === '' ? null : Number(f.validity_years.replace(',', '.'))
    if (years !== null && (!Number.isFinite(years) || years <= 0 || years > 30)) { setError('Gli anni di validità devono essere un numero tra 1 e 30, oppure vuoto se non scade.'); return }
    if (!f.name_it.trim()) { setError('Scrivi il nome della certificazione.'); return }
    const patch = { name_it: f.name_it.trim(), name_en: f.name_it.trim(), issuer: f.issuer || null, group_label: f.group_label || 'Altro', description: f.description.trim() || null, scope: f.scope.trim() || null, validity_months: years === null ? null : Math.round(years * 12), commercial: f.commercial, for_skipper: f.for_skipper, for_crew: f.for_crew }
    setBusy(true); setError(null)
    const code = f.code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_') || f.name_it.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 30)
    const { error } = open === 'new'
      ? await supabase.from('title_catalog').insert({ ...patch, code, category: 'other', sort: 90 })
      : await supabase.from('title_catalog').update(patch).eq('id', open!)
    if (error) setError(friendly(error, 'salvare la certificazione').replace('Esiste già una riga uguale', 'Esiste già una certificazione con questa sigla'))
    else { say('Certificazione salvata'); setOpen(null); await reload() }
    setBusy(false)
  }
  const toggle = async (r: CatalogItem) => {
    const { error } = await supabase.from('title_catalog').update({ is_active: !r.is_active }).eq('id', r.id)
    if (error) setError(friendly(error, 'salvare')); else { say(r.is_active ? 'Certificazione spenta' : 'Certificazione riaccesa'); await reload() }
  }
  const shown = (rows ?? []).filter((r) => !q.trim() || `${r.name_it} ${r.code} ${r.issuer ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const form = (
    <form className="space-y-3 rounded-xl bg-sand p-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-ink-soft">Nome<input className={`${input} mt-1`} value={f.name_it} onChange={(e) => setF({ ...f, name_it: e.target.value })} /></label>
        <label className="text-xs font-medium text-ink-soft">Sigla {open !== 'new' && '(non modificabile)'}<input className={`${input} mt-1`} disabled={open !== 'new'} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="Si crea da sola dal nome" /></label>
        <label className="text-xs font-medium text-ink-soft">Gruppo<select className={`${input} mt-1`} value={f.group_label} onChange={(e) => setF({ ...f, group_label: e.target.value })}><option value="">Altro</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label className="text-xs font-medium text-ink-soft">Ente che la rilascia di solito<select className={`${input} mt-1`} value={f.issuer} onChange={(e) => setF({ ...f, issuer: e.target.value })}><option value="">Non indicato</option>{[...new Set([...issuers, f.issuer].filter(Boolean))].map((g) => <option key={g}>{g}</option>)}</select></label>
        <label className="text-xs font-medium text-ink-soft">Anni di validità (vuoto se non scade)<input className={`${input} mt-1`} inputMode="decimal" value={f.validity_years} onChange={(e) => setF({ ...f, validity_years: e.target.value })} /></label>
        <label className="text-xs font-medium text-ink-soft">Ambito<input className={`${input} mt-1`} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} placeholder="Diporto / Professionale" /></label>
      </div>
      <label className="block text-xs font-medium text-ink-soft">Descrizione<textarea rows={2} className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={f.commercial} onChange={(e) => setF({ ...f, commercial: e.target.checked })} />Uso commerciale</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={f.for_skipper} onChange={(e) => setF({ ...f, for_skipper: e.target.checked })} />Nella candidatura Skipper</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={f.for_crew} onChange={(e) => setF({ ...f, for_crew: e.target.checked })} />Nella candidatura Crew</label>
      </div>
      {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="grid max-w-md grid-cols-2 gap-2"><Button type="submit" disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</Button><Button type="button" variant="ghost" onClick={() => setOpen(null)}>Annulla</Button></div>
    </form>
  )
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-base font-semibold">Catalogo delle certificazioni</h2><p className="text-xs text-ink-soft">Abilitazioni al comando e certificazioni che le persone possono dichiarare. Le regole sui requisiti (comando, SRC, First Aid) non si cambiano da qui.</p></div>
        <div className="flex gap-2"><input aria-label="Cerca nel catalogo" placeholder="Cerca…" className={`${input} w-48`} value={q} onChange={(e) => setQ(e.target.value)} /><button type="button" className="h-10 shrink-0 rounded-lg bg-ink px-4 text-sm font-semibold text-white" onClick={() => start()}>Nuova certificazione</button></div>
      </div>
      {open === 'new' && <div className="mt-3">{form}</div>}
      {open !== 'new' && error && <p role="alert" className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      {!rows ? <p className="mt-3 text-sm text-ink-soft">Carico…</p> : (
        <ul className="mt-3 divide-y divide-line">
          {shown.map((r) => (
            <li key={r.id} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="min-w-0 text-left" onClick={() => (open === r.id ? setOpen(null) : start(r))}>
                  <span className={`block text-sm font-medium ${r.is_active ? '' : 'text-ink-soft line-through'}`}>{r.name_it}</span>
                  <span className="block text-xs text-ink-soft">{[r.group_label, r.issuer, r.validity_months ? `validità ${r.validity_months / 12} anni` : 'senza scadenza'].filter(Boolean).join(' · ')}</span>
                </button>
                <span className="flex items-center gap-3 text-sm">
                  <button type="button" onClick={() => void toggle(r)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.is_active ? 'bg-ok-soft text-ok' : 'bg-sand text-ink-soft'}`}>{r.is_active ? 'Attiva' : 'Spenta'}</button>
                  <button type="button" className="font-semibold text-sea" onClick={() => start(r)}>Modifica</button>
                </span>
              </div>
              {open === r.id && <div className="mt-2">{form}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
