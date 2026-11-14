import { useEffect, useState } from 'react'
import { Button, Chip, Empty, Field, Row, Section } from '../components/ui'
import { addRow, declareTitle, listCatalog, openFile, removeSkill, saveOne, savePersonalData, uploadFile } from '../lib/deck'
import { MiniForm, num, str } from './DeckForms'
import {
  appliedAsLabel, capabilityLabel, daysTo, fmtDate, identityKindLabel, requirementLabel,
  skillKindLabel, sourceLabel, statusLabel, stepLabel, stepStatusLabel, titleStatusLabel,
} from '../lib/labels'
import type { Deck, Person, Title } from '../lib/types'

const statusTone = { registered: 'neutral', in_path: 'sea', ready: 'ok', not_accepted: 'neutral', excluded: 'bad' } as const
const titleTone = { draft: 'neutral', declared: 'sea', verified: 'ok', rejected: 'bad', replaced: 'neutral' } as const
const EXPIRY_WARNING_DAYS = 60

function expiryNote(iso: string | null): { text: string; tone: 'neutral' | 'warn' | 'bad' } {
  const d = daysTo(iso)
  if (d === null) return { text: 'Senza scadenza', tone: 'neutral' }
  if (d < 0) return { text: `Scaduto il ${fmtDate(iso)}`, tone: 'bad' }
  if (d <= EXPIRY_WARNING_DAYS) return { text: `Scade tra ${d} giorni`, tone: 'warn' }
  return { text: `Valido fino al ${fmtDate(iso)}`, tone: 'neutral' }
}

export default function MyDeck({ deck, readOnly, onChanged }: { deck: Deck; readOnly: boolean; onChanged: () => void }) {
  const { person, compliance, titles } = deck
  const activeCaps = deck.capabilities.filter((c) => c.status === 'active')
  const missing = compliance.filter((c) => !c.covered)
  const isSkipperFamily = person.family === 'skipper'
  const expiring = titles.filter((t) => { const d = daysTo(t.expires_on); return d !== null && d <= EXPIRY_WARNING_DAYS && t.status !== 'rejected' })
  const rejected = titles.filter((t) => t.status === 'rejected')
  const activePlan = deck.plans.find((p) => p.status === 'active') ?? deck.plans.at(-1)
  const canLog = person.status === 'in_path' || person.status === 'ready'
  const totals = deck.logbook.reduce((a, e) => ({ miles: a.miles + Number(e.miles ?? 0), days: a.days + (e.days ?? 0), nights: a.nights + (e.nights ?? 0) }), { miles: 0, days: 0, nights: 0 })

  return (
    <div className="space-y-3">
      {/* Riepilogo: chi sono */}
      <header className="rounded-2xl bg-ink p-5 text-white">
        <div className="flex items-center gap-4">
          <div aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15 text-lg font-semibold">
            {person.first_name[0]}{person.last_name[0]}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{person.first_name} {person.last_name}</h1>
            <p className="mt-0.5 text-sm text-white/75">
              {activeCaps.length ? activeCaps.map((c) => capabilityLabel[c.capability] ?? c.capability).join(' · ')
                : person.applied_as ? `Candidatura: ${appliedAsLabel[person.applied_as]}` : 'Profilo'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip tone={statusTone[person.status]}>{statusLabel[person.status]}</Chip>
          {isSkipperFamily && (missing.length === 0
            ? <Chip tone="ok">In regola: 3 di 3</Chip>
            : <Chip tone="warn">In regola: {3 - missing.length} di 3</Chip>)}
        </div>
      </header>

      {/* Cosa posso dimostrare: i tre requisiti */}
      {isSkipperFamily && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink-soft">Requisiti per navigare come skipper</h2>
          <ul className="mt-2 divide-y divide-line">
            {compliance.map((c) => (
              <li key={c.requirement} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{requirementLabel[c.requirement]}</span>
                  <span className="block text-xs text-ink-soft">
                    {c.covered ? `Coperto da ${titles.find((t) => t.code === c.by_title)?.name_it ?? c.by_title}` : 'Manca un titolo valido con il file caricato'}
                  </span>
                </span>
                {c.covered ? <Chip tone="ok">Coperto</Chip> : <Chip tone="warn">Manca</Chip>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section title="Dati personali" summary={person.phone ? 'Identità, contatti, lingua' : 'Manca il telefono'} tone={person.phone ? undefined : 'warn'}>
        <PersonalData person={person} readOnly={readOnly} onChanged={onChanged} />
      </Section>

      <Section title="Titoli e certificazioni"
        summary={rejected.length ? `${rejected.length} da ricaricare` : expiring.length ? `${expiring.length} in scadenza` : titles.length ? `${titles.length} caricati` : 'Nessun titolo caricato'}
        tone={rejected.length ? 'bad' : expiring.length ? 'warn' : undefined}>
        {titles.length === 0 ? <Empty>Carica qui patente, SRC e First Aid: servono per essere in regola.</Empty>
          : <ul className="divide-y divide-line">{titles.map((t) => <TitleRow key={t.id} t={t} />)}</ul>}
        {readOnly ? null : <AddTitle personId={person.id} onChanged={onChanged} />}
      </Section>

      <Section title="Documenti e assicurazioni" summary={deck.identity.length + deck.insurance.length ? `${deck.identity.length + deck.insurance.length} caricati` : 'Nessun documento caricato'}>
        {deck.identity.length + deck.insurance.length === 0 ? <Empty>Documento d'identità e polizze, con la loro scadenza.</Empty> : (
          <ul className="divide-y divide-line">
            {deck.identity.map((d) => <SimpleRow key={d.id} title={identityKindLabel[d.kind] ?? d.kind} expires={d.expires_on} filePath={d.file_path} />)}
            {deck.insurance.map((d) => <SimpleRow key={d.id} title={d.kind} sub={d.company} expires={d.expires_on} filePath={d.file_path} />)}
          </ul>
        )}
        {!readOnly && (
          <>
            <MiniForm open="Aggiungi un documento d'identità" submit="Carica" fields={[
              { name: 'kind', label: 'Tipo', type: 'select', required: true, options: Object.entries(identityKindLabel).map(([value, label]) => ({ value, label })) },
              { name: 'number', label: 'Numero (facoltativo)' },
              { name: 'expires_on', label: 'Scadenza', type: 'date', required: true },
              { name: 'file', label: 'File: PDF o foto, massimo 10 MB', type: 'file', required: true },
            ]} onSave={async (v, file) => {
              const file_id = await uploadFile(person.id, 'documenti', file!, 'identity_document')
              await addRow('identity_document', { person_id: person.id, kind: v.kind, number: str(v.number), expires_on: str(v.expires_on), file_id }); onChanged()
            }} />
            <MiniForm open="Aggiungi un'assicurazione" submit="Carica" fields={[
              { name: 'kind', label: 'Tipo di polizza', required: true, placeholder: 'Per esempio: responsabilità civile skipper' },
              { name: 'company', label: 'Compagnia (facoltativo)' },
              { name: 'policy_number', label: 'Numero di polizza (facoltativo)' },
              { name: 'expires_on', label: 'Scadenza', type: 'date', required: true },
              { name: 'file', label: 'File: PDF o foto, massimo 10 MB', type: 'file', required: true },
            ]} onSave={async (v, file) => {
              const file_id = await uploadFile(person.id, 'assicurazioni', file!, 'insurance')
              await addRow('insurance', { person_id: person.id, kind: str(v.kind), company: str(v.company), policy_number: str(v.policy_number), expires_on: str(v.expires_on), file_id }); onChanged()
            }} />
          </>
        )}
      </Section>

      <Section title="Competenze e lingue" summary={deck.skills.length ? `${deck.skills.length} voci` : 'Ancora da compilare'}>
        {deck.skills.length === 0 ? <Empty>Lingue, competenze tecniche, zone e tipi di barca che conosci.</Empty> : (
          <div className="space-y-3">
            {(['language', 'technical', 'area', 'boat_type'] as const).map((k) => {
              const items = deck.skills.filter((s) => s.kind === k)
              return items.length === 0 ? null : (
                <div key={k}>
                  <h3 className="text-xs font-semibold text-ink-soft">{skillKindLabel[k]}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {items.map((s) => (
                      <Chip key={s.value}>{s.value}{s.level ? ` · ${s.level}` : ''}
                        {!readOnly && <button type="button" aria-label={`Togli ${s.value}`} className="ml-1.5 text-sm leading-none text-ink-soft" onClick={() => void removeSkill(person.id, k, s.value).then(onChanged)}>×</button>}
                      </Chip>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {!readOnly && <MiniForm open="Aggiungi una voce" submit="Aggiungi" fields={[
          { name: 'kind', label: 'Che cosa', type: 'select', required: true, options: Object.entries(skillKindLabel).map(([value, label]) => ({ value, label })) },
          { name: 'value', label: 'Voce', required: true, placeholder: 'Per esempio: Inglese, Catamarano, Grecia ionica' },
          { name: 'level', label: 'Livello (facoltativo)', placeholder: 'Per esempio: B2' },
        ]} onSave={async (v) => { await addRow('person_skill', { person_id: person.id, kind: v.kind, value: str(v.value), level: str(v.level) }); onChanged() }} />}
      </Section>

      <Section title="Logbook" summary={deck.logbook.length ? `${Math.round(totals.miles)} miglia · ${totals.days} giorni · ${totals.nights} notti` : canLog ? 'Nessuna navigazione registrata' : 'Disponibile quando sei In percorso'}>
        {deck.logbook.length === 0 ? <Empty>{canLog ? 'Registra qui le tue navigazioni: restano tue per sempre.' : 'Il logbook si apre quando la tua candidatura viene accettata.'}</Empty> : (
          <ul className="divide-y divide-line">
            {deck.logbook.map((e) => (
              <li key={e.id} className="py-2.5">
                <p className="text-sm font-medium">{e.route ?? 'Navigazione'}</p>
                <p className="text-xs text-ink-soft">{fmtDate(e.from_date)} – {fmtDate(e.to_date)} · {e.miles ?? 0} miglia · {sourceLabel[e.source]}</p>
              </li>
            ))}
          </ul>
        )}
        {canLog && !readOnly && <MiniForm open="Aggiungi una navigazione" submit="Aggiungi" fields={[
          { name: 'from_date', label: 'Dal', type: 'date', required: true },
          { name: 'to_date', label: 'Al', type: 'date', required: true },
          { name: 'route', label: 'Rotta', required: true, placeholder: 'Per esempio: Olbia – Bonifacio – Olbia' },
          { name: 'miles', label: 'Miglia', type: 'number', required: true },
          { name: 'days', label: 'Giorni', type: 'number' },
          { name: 'nights', label: 'Notti in navigazione', type: 'number' },
          { name: 'role_on_board', label: 'Il tuo ruolo a bordo', type: 'select', options: [{ value: 'skipper', label: 'Skipper' }, { value: 'co_skipper', label: 'Co-skipper' }, { value: 'fleet_leader', label: 'Capoflotta' }, { value: 'crew_assistant', label: 'Crew assistant' }, { value: 'hostess', label: 'Hostess' }, { value: 'cook', label: 'Cuoco' }, { value: 'staff', label: 'Staff' }] },
          { name: 'boat_name', label: 'Barca (facoltativo)' },
          { name: 'boat_type', label: 'Tipo di barca (facoltativo)', placeholder: 'Per esempio: catamarano 45 piedi' },
        ]} onSave={async (v) => {
          if (str(v.to_date)! < str(v.from_date)!) throw new Error('La data di fine viene prima di quella di inizio.')
          await addRow('logbook_entry', { person_id: person.id, source: 'declared', from_date: str(v.from_date), to_date: str(v.to_date), route: str(v.route), miles: num(v.miles), days: num(v.days), nights: num(v.nights), role_on_board: str(v.role_on_board), boat_name: str(v.boat_name), boat_type: str(v.boat_type) }); onChanged()
        }} />}
      </Section>

      <Section title="Il mio percorso" summary={activePlan ? `${activePlan.steps.filter((s) => s.status === 'done').length} passi fatti su ${activePlan.steps.filter((s) => s.status !== 'not_required').length}` : 'In attesa che la candidatura venga valutata'}>
        {!activePlan ? <Empty>Quando la tua candidatura viene accettata, qui trovi i passi da fare per diventare Ready.</Empty> : (
          <>
            <p className="mb-2 text-sm text-ink-soft">Obiettivo: <span className="font-medium text-ink">{capabilityLabel[activePlan.goal_capability] ?? activePlan.goal_capability}</span></p>
            <ol className="space-y-2">
              {activePlan.steps.map((s) => (
                <li key={s.kind} className="flex items-center gap-3">
                  <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${s.status === 'done' ? 'bg-ok text-white' : s.status === 'in_progress' ? 'bg-sea text-white' : 'bg-sand text-ink-soft'}`}>
                    {s.status === 'done' ? '✓' : s.position}
                  </span>
                  <span className="flex-1 text-sm font-medium">{stepLabel[s.kind]}</span>
                  <span className="text-xs text-ink-soft">{s.status === 'done' && s.done_at ? fmtDate(s.done_at.slice(0, 10)) : stepStatusLabel[s.status]}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </Section>

      <Section title="Dati fiscali" summary={deck.tax?.tax_code ? 'Compilati' : 'Da compilare quando vuoi'}>
        <Row label="Codice fiscale" value={deck.tax?.tax_code} />
        <Row label="Regime" value={deck.tax?.tax_regime} />
        <Row label="Partita IVA" value={deck.tax?.vat_number} />
        <Row label="IBAN" value={deck.tax?.iban} />
        <Row label="Intestatario del conto" value={deck.tax?.account_holder} />
        {!readOnly && <MiniForm open="Modifica" fields={[
          { name: 'tax_code', label: 'Codice fiscale', initial: deck.tax?.tax_code ?? '' },
          { name: 'tax_regime', label: 'Regime fiscale', type: 'select', initial: deck.tax?.tax_regime ?? '', options: ['Prestazione occasionale', 'Forfettario', 'Ordinario', 'Altro'].map((x) => ({ value: x, label: x })) },
          { name: 'vat_number', label: 'Partita IVA (se ce l\'hai)', initial: deck.tax?.vat_number ?? '' },
          { name: 'iban', label: 'IBAN', initial: deck.tax?.iban ?? '' },
          { name: 'account_holder', label: 'Intestatario del conto', initial: deck.tax?.account_holder ?? '' },
        ]} onSave={async (v) => { await saveOne('tax_profile', person.id, { tax_code: str(v.tax_code)?.toUpperCase() ?? null, tax_regime: str(v.tax_regime), vat_number: str(v.vat_number), iban: str(v.iban)?.replace(/\s+/g, '').toUpperCase() ?? null, account_holder: str(v.account_holder) }); onChanged() }} />}
      </Section>

      <Section title="Preferenze e consensi" summary={deck.preferences?.marketing_opt_out ? 'Email promozionali spente' : 'Email promozionali accese'}>
        <Row label="Consenso privacy" value={deck.preferences?.privacy_consent_at ? `Dato il ${fmtDate(deck.preferences.privacy_consent_at.slice(0, 10))}` : null} />
        <Row label="Email promozionali" value={deck.preferences?.marketing_opt_out ? 'Spente' : 'Accese'} />
        <Row label="Profilo in vetrina" value={deck.preferences?.showcase_consent ? 'Sì' : 'No'} />
        {!readOnly && <MiniForm open="Modifica" fields={[
          { name: 'marketing', label: 'Voglio ricevere le email promozionali', type: 'checkbox', initial: !deck.preferences?.marketing_opt_out },
          { name: 'showcase', label: 'Acconsento a comparire nella vetrina dei profili', type: 'checkbox', initial: !!deck.preferences?.showcase_consent },
        ]} onSave={async (v) => { await saveOne('person_preferences', person.id, { marketing_opt_out: !v.marketing, showcase_consent: !!v.showcase }); onChanged() }} />}
      </Section>
    </div>
  )
}

function TitleRow({ t }: { t: Title }) {
  const ex = expiryNote(t.expires_on)
  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium">{t.name_it}</p>
        <Chip tone={titleTone[t.status]}>{titleStatusLabel[t.status]}</Chip>
      </div>
      <p className={`mt-0.5 text-xs ${ex.tone === 'bad' ? 'text-bad' : ex.tone === 'warn' ? 'text-warn' : 'text-ink-soft'}`}>
        {ex.text}{!t.has_file ? ' · manca il file' : ''}
      </p>
      {t.status === 'rejected' && t.rejection_reason && <p className="mt-1 rounded-lg bg-bad-soft px-2.5 py-1.5 text-xs text-bad">{t.rejection_reason}</p>}
      {t.file_path && <button type="button" className="mt-1 text-xs font-semibold text-sea" onClick={() => void openFile(t.file_path!).catch((e) => alertError(e))}>Apri il file</button>}
    </li>
  )
}

function SimpleRow({ title, sub, expires, filePath }: { title: string; sub?: string | null; expires: string | null; filePath?: string | null }) {
  const ex = expiryNote(expires)
  return (
    <li className="py-2.5">
      <p className="text-sm font-medium">{title}</p>
      <p className={`text-xs ${ex.tone === 'bad' ? 'text-bad' : ex.tone === 'warn' ? 'text-warn' : 'text-ink-soft'}`}>{sub ? `${sub} · ` : ''}{ex.text}</p>
      {filePath && <button type="button" className="mt-1 text-xs font-semibold text-sea" onClick={() => void openFile(filePath).catch(alertError)}>Apri il file</button>}
    </li>
  )
}

function PersonalData({ person, readOnly, onChanged }: { person: Person; readOnly: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ first_name: person.first_name, last_name: person.last_name, phone: person.phone ?? '', birth_date: person.birth_date ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!editing) {
    return (
      <>
        <Row label="Nome" value={`${person.first_name} ${person.last_name}`} />
        <Row label="Email" value={person.email} />
        <Row label="Telefono" value={person.phone} />
        <Row label="Data di nascita" value={person.birth_date ? fmtDate(person.birth_date) : null} />
        <Row label="Lingua" value={person.ui_language === 'it' ? 'Italiano' : 'English'} />
        <Button variant="ghost" className="mt-3" onClick={() => setEditing(true)} disabled={readOnly}>
          {readOnly ? 'Modifica · non attiva in sola lettura' : 'Modifica'}
        </Button>
      </>
    )
  }
  const save = async () => {
    setBusy(true); setError(null)
    try {
      await savePersonalData(person.id, {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        phone: form.phone.trim() || null, birth_date: form.birth_date || null, ui_language: person.ui_language,
      })
      setEditing(false); onChanged()
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio non riuscito') } finally { setBusy(false) }
  }
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <Field label="Nome" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
      <Field label="Cognome" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
      <Field label="Telefono" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <Field label="Data di nascita" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</Button>
      <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Annulla</Button>
    </form>
  )
}

function alertError(e: unknown) { console.error(e) }

function AddTitle({ personId, onChanged }: { personId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<{ id: string; name_it: string }[]>([])
  const [titleId, setTitleId] = useState(''); const [expires, setExpires] = useState(''); const [number, setNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open && catalog.length === 0) listCatalog().then(setCatalog).catch((e) => setError(e?.message ?? 'Errore')) }, [open, catalog.length])

  if (!open) return <Button variant="ghost" className="mt-3" onClick={() => setOpen(true)}>Aggiungi un titolo</Button>
  const submit = async () => {
    if (!file || !titleId) return
    setBusy(true); setError(null)
    try {
      await declareTitle(personId, { titleId, expiresOn: expires || null, number: number.trim() || null, file })
      setOpen(false); setFile(null); setTitleId(''); setExpires(''); setNumber(''); onChanged()
    } catch (e) { setError(e instanceof Error ? e.message : 'Caricamento non riuscito') } finally { setBusy(false) }
  }
  return (
    <form className="mt-3 space-y-3 rounded-xl bg-sand p-3" onSubmit={(e) => { e.preventDefault(); void submit() }}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-soft">Quale titolo</span>
        <select required value={titleId} onChange={(e) => setTitleId(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-card px-3 text-base">
          <option value="" disabled>Scegli…</option>
          {catalog.map((c) => <option key={c.id} value={c.id}>{c.name_it}</option>)}
        </select>
      </label>
      <Field label="Scadenza (lascia vuoto se non scade)" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
      <Field label="Numero (facoltativo)" value={number} onChange={(e) => setNumber(e.target.value)} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-soft">File del titolo: PDF o foto, massimo 10 MB</span>
        <input required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:text-sm file:font-semibold file:text-white" />
      </label>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <Button type="submit" disabled={busy || !file || !titleId}>{busy ? 'Carico…' : 'Carica e dichiara'}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
    </form>
  )
}
