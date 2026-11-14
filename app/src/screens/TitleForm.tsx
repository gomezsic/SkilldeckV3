import { useEffect, useMemo, useState } from 'react'
import { Button, Chip, Field, FileField } from '../components/ui'
import { saveTitle } from '../lib/deck'
import { friendly, say, useUnsaved } from '../lib/friendly'
import { type CatalogItem, type Option, loadCatalog, loadLists, pick } from '../lib/lists'
import type { Title } from '../lib/types'

const today = () => new Date().toISOString().slice(0, 10)
const addMonths = (iso: string, months: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10) }
const validityText = (m: number | null) => (m ? `Validità: ${m % 12 === 0 ? `${m / 12} ${m === 12 ? 'anno' : 'anni'}` : `${m} mesi`}` : 'Senza scadenza')
const selectCls = 'h-12 w-full rounded-xl border border-line bg-card px-3 text-base'

/** La scheda di una certificazione o abilitazione: scelta dal catalogo, ente, numero, rilascio, scadenza, file. */
export default function TitleForm({ personId, owned, edit, label, small, onChanged }: {
  personId: string; owned: Title[]; edit?: Title; label?: string; small?: boolean; onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null)
  const [lists, setLists] = useState<Option[]>([])
  const [chosen, setChosen] = useState<CatalogItem | null>(null)
  const [q, setQ] = useState('')
  const [issuer, setIssuer] = useState(''); const [otherIssuer, setOtherIssuer] = useState('')
  const [number, setNumber] = useState(''); const [issued, setIssued] = useState(''); const [expires, setExpires] = useState('')
  const [noExpiry, setNoExpiry] = useState(false); const [autoExpiry, setAutoExpiry] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || catalog) return
    Promise.all([loadCatalog(), loadLists()]).then(([c, l]) => {
      setCatalog(c); setLists(l)
      if (edit) {
        const item = c.find((x) => x.id === edit.title_id) ?? null
        setChosen(item); setNumber(edit.number ?? ''); setIssued(edit.issued_on ?? ''); setExpires(edit.expires_on ?? '')
        setNoExpiry(!edit.expires_on && edit.status !== 'draft' && !item?.validity_months)
        const known = pick(l, 'issuer').map((o) => o.label); const current = edit.issuer ?? item?.issuer ?? ''
        if (current && !known.includes(current)) { setIssuer('__altro'); setOtherIssuer(current) } else setIssuer(current)
      }
    }).catch((e) => setError(friendly(e, 'leggere il catalogo delle certificazioni')))
  }, [open, catalog, edit])
  useUnsaved(open && (!!file || !!number || !!issued || (!edit && !!chosen)))

  const issuers = useMemo(() => pick(lists, 'issuer').map((o) => o.label), [lists])
  const groups = useMemo(() => {
    const order = pick(lists, 'title_group').map((o) => o.label)
    const term = q.trim().toLowerCase()
    const items = (catalog ?? []).filter((c) => !term || `${c.name_it} ${c.code} ${c.issuer ?? ''} ${c.group_label ?? ''}`.toLowerCase().includes(term))
    const names = [...new Set([...order, ...items.map((i) => i.group_label ?? 'Altro')])]
    return names.map((g) => ({ group: g, items: items.filter((i) => (i.group_label ?? 'Altro') === g) })).filter((g) => g.items.length)
  }, [catalog, lists, q])
  const ownedIds = new Set(owned.filter((t) => t.status !== 'draft' && !t.archived_at).map((t) => t.title_id))

  const choose = (c: CatalogItem) => {
    setChosen(c); setError(null)
    setIssuer(c.issuer && issuers.includes(c.issuer) ? c.issuer : c.issuer ? '__altro' : ''); setOtherIssuer(c.issuer && !issuers.includes(c.issuer) ? c.issuer : '')
    setNoExpiry(false); setExpires(''); setAutoExpiry(false)
  }
  const onIssued = (v: string) => {
    setIssued(v)
    if (v && chosen?.validity_months && !noExpiry && (!expires || autoExpiry)) { setExpires(addMonths(v, chosen.validity_months)); setAutoExpiry(true) }
  }
  const close = () => { setOpen(false); setCatalog(null); setChosen(null); setQ(''); setFile(null); setNumber(''); setIssued(''); setExpires(''); setError(null) }

  const realIssuer = issuer === '__altro' ? otherIssuer.trim() : issuer
  const problems: string[] = []
  if (issued && issued > today()) problems.push('La data di rilascio è nel futuro: controlla l\'anno.')
  if (issued && expires && !noExpiry && expires < issued) problems.push('La scadenza viene prima del rilascio: controlla le due date.')
  const expired = !noExpiry && expires && expires < today()
  const needsFile = !edit || !edit.has_file

  const submit = async () => {
    if (!chosen) return
    if (!issued) { setError('Indica la data di rilascio: la trovi sul documento.'); return }
    if (problems.length) { setError(problems[0]); return }
    if (!noExpiry && !expires && chosen.validity_months) { setError('Indica la data di scadenza, oppure spunta "Non scade" se sul documento non c\'è.'); return }
    if (needsFile && !file) { setError('Manca il file: carica il PDF o una foto del documento.'); return }
    setBusy(true); setError(null)
    try {
      await saveTitle(personId, { titleId: chosen.id, issuer: realIssuer || null, number: number.trim() || null, issuedOn: issued, expiresOn: noExpiry ? null : expires || null, file }, edit ? { id: edit.id, status: edit.status } : undefined)
      say(edit ? 'Certificazione salvata' : 'Certificazione caricata'); close(); onChanged()
    } catch (e) { setError(friendly(e, 'salvare la certificazione')) } finally { setBusy(false) }
  }

  if (!open) {
    const text = label ?? (edit ? 'Modifica' : 'Aggiungi una certificazione')
    return small ? <button type="button" className="text-xs font-semibold text-sea" onClick={() => setOpen(true)}>{text}</button>
      : <Button variant="ghost" className="mt-3" onClick={() => setOpen(true)}>{text}</Button>
  }
  if (!catalog) return <p className="mt-3 w-full rounded-xl bg-sand p-3 text-sm text-ink-soft">{error ?? 'Carico il catalogo…'}</p>

  if (!chosen) return (
    <div className="mt-3 w-full rounded-xl bg-sand p-3">
      <p className="text-sm font-semibold">Quale certificazione vuoi aggiungere?</p>
      <input type="search" autoFocus aria-label="Cerca certificazione" placeholder="Cerca per nome, sigla o ente…" value={q} onChange={(e) => setQ(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-line bg-card px-3 text-base" />
      <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto">
        {groups.length === 0 && <p className="text-sm text-ink-soft">Nessuna certificazione con questo nome. Prova con un'altra parola.</p>}
        {groups.map((g) => (
          <section key={g.group}>
            <h3 className="sticky top-0 bg-sand py-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">{g.group} · {g.items.length}</h3>
            <ul className="space-y-1.5">
              {g.items.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => choose(c)} className="w-full rounded-xl border border-line bg-card p-3 text-left hover:border-ink">
                    <span className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{c.name_it}</span>{ownedIds.has(c.id) && <Chip tone="ok">Già nel profilo</Chip>}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{[c.issuer, validityText(c.validity_months)].filter(Boolean).join(' · ')}</span>
                    {c.description && <span className="mt-1 block text-xs text-ink-soft">{c.description}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Button type="button" variant="ghost" className="mt-3" onClick={close}>Annulla</Button>
    </div>
  )

  return (
    <form className="mt-3 w-full space-y-3 rounded-xl bg-sand p-3" noValidate onSubmit={(e) => { e.preventDefault(); void submit() }}>
      <div className="rounded-xl border border-line bg-card p-3">
        <p className="text-sm font-semibold">{chosen.name_it}</p>
        <p className="text-xs text-ink-soft">{[chosen.group_label, chosen.scope, validityText(chosen.validity_months)].filter(Boolean).join(' · ')}</p>
        {!edit && <button type="button" className="mt-1 text-xs font-semibold text-sea" onClick={() => setChosen(null)}>‹ Cambia certificazione</button>}
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-soft">Ente che l'ha rilasciata</span>
        <select className={selectCls} value={issuer} onChange={(e) => setIssuer(e.target.value)}>
          <option value="">Scegli…</option>
          {issuers.map((i) => <option key={i}>{i}</option>)}
          <option value="__altro">Un altro ente…</option>
        </select>
      </label>
      {issuer === '__altro' && <Field label="Nome dell'ente" value={otherIssuer} onChange={(e) => setOtherIssuer(e.target.value)} />}
      <Field label="Numero del documento (facoltativo)" placeholder="Es. ABC123456" value={number} onChange={(e) => setNumber(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Data di rilascio" type="date" min="1960-01-01" max={today()} value={issued} onChange={(e) => onIssued(e.target.value)} />
        <div>
          <Field label="Data di scadenza" type="date" min={issued || '2000-01-01'} disabled={noExpiry} value={noExpiry ? '' : expires} onChange={(e) => { setExpires(e.target.value); setAutoExpiry(false) }} />
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={noExpiry} onChange={(e) => { setNoExpiry(e.target.checked); if (e.target.checked) setExpires('') }} />Non scade</label>
        </div>
      </div>
      {autoExpiry && !noExpiry && expires && <p className="text-xs text-ink-soft">Scadenza calcolata da sola: rilascio più {validityText(chosen.validity_months).replace('Validità: ', '')}. Se sul documento è diversa, correggila.</p>}
      {problems.map((p) => <p key={p} role="status" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{p}</p>)}
      {expired && problems.length === 0 && <p role="status" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">Con questa data la certificazione risulta già scaduta. Se è giusto così puoi salvarla lo stesso, ma non varrà come requisito.</p>}
      <FileField label={needsFile ? 'Documento: PDF o foto, massimo 10 MB' : 'Sostituisci il documento (facoltativo)'} onFile={setFile} />
      {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Salvo…' : edit ? 'Salva la certificazione' : 'Carica e dichiara'}</Button>
      <Button type="button" variant="ghost" onClick={close}>Annulla</Button>
    </form>
  )
}
