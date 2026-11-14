import { useEffect, useState } from 'react'
import { Button, Chip, Empty, Field, Row, Section } from '../components/ui'
import { friendly, say, useUnsaved } from '../lib/friendly'
import { addRow, archiveRow, openFile, saveOne, savePersonalData, updateRow, uploadFile } from '../lib/deck'
import TitleForm from './TitleForm'
import Curriculum from './Curriculum'
import Logbook from './Logbook'
import { Letters, PhotoAvatar, Tax } from './ProfileExtras'
import { loadLists, pick } from '../lib/lists'
import { ConfirmLink, MiniForm, dateLimits, expiredWarning, str } from './DeckForms'
import type { FieldSpec } from './DeckForms'
import {
  appliedAsLabel, capabilityLabel, daysTo, fmtDate, identityKindLabel, requirementLabel, statusLabel, stepLabel, stepStatusLabel, titleStatusLabel,
} from '../lib/labels'
import type { Deck, IdentityDoc, Insurance, Person, Title } from '../lib/types'

const statusTone = { registered: 'neutral', in_path: 'sea', ready: 'ok', not_accepted: 'neutral', excluded: 'bad' } as const
const titleTone = { draft: 'neutral', declared: 'sea', verified: 'ok', rejected: 'bad', replaced: 'neutral' } as const
const EXPIRY_WARNING_DAYS = 90

function expiryNote(iso: string | null): { text: string; tone: 'neutral' | 'warn' | 'bad' } {
  const d = daysTo(iso)
  if (d === null) return { text: 'Senza scadenza', tone: 'neutral' }
  if (d < 0) return { text: `Scaduto il ${fmtDate(iso)}`, tone: 'bad' }
  if (d <= 30) return { text: d === 0 ? 'Scade oggi: rinnovalo subito' : `Scade tra ${d} ${d === 1 ? 'giorno' : 'giorni'}: rinnovalo subito`, tone: 'bad' }
  if (d <= EXPIRY_WARNING_DAYS) return { text: `Scade tra ${d} giorni (${fmtDate(iso)}): pensa al rinnovo`, tone: 'warn' }
  return { text: `Valido fino al ${fmtDate(iso)}`, tone: 'neutral' }
}

/**
 * admin: chi guarda è l'amministratore sulla scheda di un'altra persona. Ogni riga diventa modificabile,
 * archiviabile o eliminabile, e in fondo a ogni sezione compare ciò che è stato archiviato.
 */
export default function MyDeck({ deck, readOnly, onChanged, admin = false }: { deck: Deck; readOnly: boolean; onChanged: () => void; admin?: boolean }) {
  const { person, compliance } = deck
  const [lists, setLists] = useState<{ insurance: string[]; tax: string[] }>({ insurance: [], tax: [] })
  useEffect(() => { loadLists().then((l) => setLists({ insurance: pick(l, 'insurance_kind').map((o) => o.label), tax: pick(l, 'tax_position').map((o) => o.label) })).catch(() => undefined) }, [])
  const letters = (deck.letters ?? []).filter((l) => !l.archived_at)
  const titles = deck.titles.filter((t) => !t.archived_at)
  const identity = deck.identity.filter((d) => !d.archived_at)
  const insurance = deck.insurance.filter((d) => !d.archived_at)
  const archived = [
    ...deck.titles.filter((t) => t.archived_at).map((t) => ({ table: 'person_title' as const, id: t.id, label: t.name_it })),
    ...deck.identity.filter((d) => d.archived_at).map((d) => ({ table: 'identity_document' as const, id: d.id, label: identityKindLabel[d.kind] ?? d.kind })),
    ...deck.insurance.filter((d) => d.archived_at).map((d) => ({ table: 'insurance' as const, id: d.id, label: d.kind })),
  ]
  const activeCaps = deck.capabilities.filter((c) => c.status === 'active')
  const missing = compliance.filter((c) => !c.covered)
  const isSkipperFamily = person.family === 'skipper'
  const expiring = titles.filter((t) => { const d = daysTo(t.expires_on); return d !== null && d <= EXPIRY_WARNING_DAYS && t.status !== 'rejected' })
  const rejected = titles.filter((t) => t.status === 'rejected')
  const activePlan = deck.plans.find((p) => p.status === 'active') ?? deck.plans.at(-1)
  const canLog = person.status === 'in_path' || person.status === 'ready'
  const identityFields = (d?: IdentityDoc): FieldSpec[] => [
    { name: 'kind', label: 'Tipo', type: 'select', required: true, initial: d?.kind ?? '', options: Object.entries(identityKindLabel).map(([value, label]) => ({ value, label })) },
    { name: 'issuer', label: 'Ente che lo ha rilasciato', placeholder: 'Per esempio: Comune di Genova', initial: d?.issuer ?? '' },
    { name: 'number', label: 'Numero del documento', initial: d?.number ?? '' },
    { name: 'issued_on', label: 'Data di rilascio', type: 'date', initial: d?.issued_on ?? '', ...dateLimits.past },
    { name: 'expires_on', label: 'Data di scadenza', type: 'date', required: true, initial: d?.expires_on ?? '', min: dateLimits.expiry.min, max: dateLimits.expiry.max },
  ]
  const identityRow = (v: Record<string, string | boolean>) => { datesOk(v); return { kind: v.kind, issuer: str(v.issuer), number: str(v.number), issued_on: str(v.issued_on), expires_on: str(v.expires_on) } }
  const insuranceFields = (d?: Insurance): FieldSpec[] => [
    { name: 'kind', label: 'Tipo di polizza', type: 'select', required: true, initial: d?.kind ?? '', options: [...new Set([...(d?.kind ? [d.kind] : []), ...lists.insurance])].map((x) => ({ value: x, label: x })) },
    { name: 'company', label: 'Compagnia', required: true, initial: d?.company ?? '' },
    { name: 'policy_number', label: 'Numero di polizza', initial: d?.policy_number ?? '' },
    { name: 'issued_on', label: 'Valida dal', type: 'date', initial: d?.issued_on ?? '', ...dateLimits.past },
    { name: 'expires_on', label: 'Data di scadenza', type: 'date', required: true, initial: d?.expires_on ?? '', min: dateLimits.expiry.min, max: dateLimits.expiry.max },
  ]
  const insuranceRow = (v: Record<string, string | boolean>) => { datesOk(v); return { kind: str(v.kind), company: str(v.company), policy_number: str(v.policy_number), issued_on: str(v.issued_on), expires_on: str(v.expires_on) } }
  const totals = deck.logbook.reduce((a, e) => ({ miles: a.miles + Number(e.miles ?? 0), days: a.days + (e.days ?? 0), nights: a.nights + (e.nights ?? 0) }), { miles: 0, days: 0, nights: 0 })

  return (
    <div className="space-y-3">
      {/* Riepilogo: chi sono */}
      <header className="rounded-2xl bg-ink p-5 text-white">
        <div className="flex items-center gap-4">
          <PhotoAvatar deck={deck} editable={!readOnly} onChanged={onChanged} />
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
          : <ul className="divide-y divide-line">{titles.map((t) => (
            <TitleRow key={t.id} t={t}>
              {!readOnly && (admin || t.status !== 'verified') && <TitleForm small personId={person.id} owned={titles} edit={t} label={t.status === 'draft' ? 'Completa e carica il documento' : t.status === 'rejected' ? 'Correggi e ricarica' : 'Modifica'} onChanged={onChanged} />}
              {admin && <ConfirmLink label="Archivia" question="Lo tolgo dalla scheda? Resta in archivio e si può ripristinare." yes="Sì, archivia" onConfirm={async () => { await archiveRow('person_title', t.id); onChanged() }} />}
            </TitleRow>
          ))}</ul>}
        {readOnly ? null : <TitleForm personId={person.id} owned={titles} onChanged={onChanged} />}
      </Section>

      <Section title="Documenti e assicurazioni" summary={identity.length + insurance.length ? `${identity.length + insurance.length} caricati` : 'Nessun documento caricato'}>
        {identity.length + insurance.length === 0 ? <Empty>Documento d'identità e polizze, con la loro scadenza.</Empty> : (
          <ul className="divide-y divide-line">
            {identity.map((d) => (
              <SimpleRow key={d.id} title={identityKindLabel[d.kind] ?? d.kind} sub={[d.issuer, d.number].filter(Boolean).join(' · ') || null} expires={d.expires_on} filePath={d.file_path}>
                {!readOnly && <MiniForm small open="Modifica" warn={expiredWarning} fields={identityFields(d)} onSave={async (v) => { await updateRow('identity_document', d.id, identityRow(v)); onChanged() }} />}
                {admin && <ConfirmLink label="Archivia" question="Lo tolgo dalla scheda? Resta in archivio e si può ripristinare." yes="Sì, archivia" onConfirm={async () => { await archiveRow('identity_document', d.id); onChanged() }} />}
              </SimpleRow>
            ))}
            {insurance.map((d) => (
              <SimpleRow key={d.id} title={d.kind} sub={d.company} expires={d.expires_on} filePath={d.file_path}>
                {!readOnly && <MiniForm small open="Modifica" warn={expiredWarning} fields={insuranceFields(d)} onSave={async (v) => { await updateRow('insurance', d.id, insuranceRow(v)); onChanged() }} />}
                {admin && <ConfirmLink label="Archivia" question="La tolgo dalla scheda? Resta in archivio e si può ripristinare." yes="Sì, archivia" onConfirm={async () => { await archiveRow('insurance', d.id); onChanged() }} />}
              </SimpleRow>
            ))}
          </ul>
        )}
        {!readOnly && (
          <>
            <MiniForm open="Aggiungi un documento d'identità" submit="Carica" done="Documento caricato" warn={expiredWarning} fields={[...identityFields(), { name: 'file', label: 'File: PDF o foto, massimo 10 MB', type: 'file', required: true }]} onSave={async (v, file) => {
              const row = identityRow(v)
              const file_id = await uploadFile(person.id, 'documenti', file!, 'identity_document')
              await addRow('identity_document', { person_id: person.id, ...row, file_id }); onChanged()
            }} />
            <MiniForm open="Aggiungi un'assicurazione" submit="Carica" done="Assicurazione caricata" warn={expiredWarning} fields={[...insuranceFields(), { name: 'file', label: 'File: PDF o foto, massimo 10 MB', type: 'file', required: true }]} onSave={async (v, file) => {
              const row = insuranceRow(v)
              const file_id = await uploadFile(person.id, 'assicurazioni', file!, 'insurance')
              await addRow('insurance', { person_id: person.id, ...row, file_id }); onChanged()
            }} />
          </>
        )}
        {admin && archived.length > 0 && (
          <div className="mt-4 rounded-xl bg-sand p-3">
            <h3 className="text-xs font-semibold text-ink-soft">In archivio · titoli e documenti tolti dalla scheda</h3>
            <ul className="mt-1 divide-y divide-line">
              {archived.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-ink-soft">{a.label}</span>
                  <button type="button" className="text-xs font-semibold text-sea" onClick={() => void archiveRow(a.table, a.id, true).then(onChanged).catch(alertError)}>Ripristina</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Curriculum" summary={deck.profile?.description || deck.skills.length ? `${deck.skills.length} voci · ${deck.profile?.description ? 'presentazione scritta' : 'manca la presentazione'}` : 'Ancora da compilare'}>
        <Curriculum deck={deck} readOnly={readOnly} onChanged={onChanged} />
      </Section>

      <Section title="Lettere di referenza" summary={letters.length ? `${letters.length} ${letters.length === 1 ? 'lettera caricata' : 'lettere caricate'}` : 'Nessuna lettera caricata'}>
        <Letters deck={deck} readOnly={readOnly} onChanged={onChanged} />
      </Section>

      <Section title="Logbook" summary={deck.logbook.length ? `${Math.round(totals.miles)} miglia · ${totals.days} giorni · ${totals.nights} notti` : canLog ? 'Nessuna navigazione registrata' : 'Disponibile quando sei In percorso'}>
        <Logbook deck={deck} readOnly={readOnly} admin={admin} onChanged={onChanged} />
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

      <Section title="Dati fiscali" summary={deck.tax?.tax_code || deck.tax?.no_tax_code ? (deck.tax?.iban ? 'Compilati' : 'Manca l\'IBAN') : 'Da compilare quando vuoi'}>
        <Tax deck={deck} readOnly={readOnly} positions={lists.tax} onChanged={onChanged} />
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

function TitleRow({ t, children }: { t: Title; children?: React.ReactNode }) {
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
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        {t.file_path && <button type="button" className="text-xs font-semibold text-sea" onClick={() => void openFile(t.file_path!).catch((e) => alertError(e))}>Apri il file</button>}
        {children}
      </div>
    </li>
  )
}

function SimpleRow({ title, sub, expires, filePath, children }: { title: string; sub?: string | null; expires: string | null; filePath?: string | null; children?: React.ReactNode }) {
  const ex = expiryNote(expires)
  return (
    <li className="py-2.5">
      <p className="text-sm font-medium">{title}</p>
      <p className={`text-xs ${ex.tone === 'bad' ? 'text-bad' : ex.tone === 'warn' ? 'text-warn' : 'text-ink-soft'}`}>{sub ? `${sub} · ` : ''}{ex.text}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        {filePath && <button type="button" className="text-xs font-semibold text-sea" onClick={() => void openFile(filePath).catch(alertError)}>Apri il file</button>}
        {children}
      </div>
    </li>
  )
}

function PersonalData({ person, readOnly, onChanged }: { person: Person; readOnly: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ first_name: person.first_name, last_name: person.last_name, phone: person.phone ?? '', birth_date: person.birth_date ?? '', gender: person.gender ?? '', address: person.address ?? '', city: person.city ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useUnsaved(editing && (form.first_name !== person.first_name || form.last_name !== person.last_name || form.phone !== (person.phone ?? '') || form.birth_date !== (person.birth_date ?? '') || form.address !== (person.address ?? '') || form.city !== (person.city ?? '') || form.gender !== (person.gender ?? '')))

  if (!editing) {
    return (
      <>
        <Row label="Nome" value={`${person.first_name} ${person.last_name}`} />
        <Row label="Email" value={person.email} />
        <Row label="Telefono" value={person.phone} />
        <Row label="Data di nascita" value={person.birth_date ? fmtDate(person.birth_date) : null} />
        <Row label="Sesso" value={person.gender} />
        <Row label="Residenza" value={[person.address, person.city].filter(Boolean).join(', ') || null} />
        <Row label="Lingua madre" value={person.mother_tongue} />
        <Row label="Lingua dell'app" value={person.ui_language === 'it' ? 'Italiano' : 'English'} />
        <Button variant="ghost" className="mt-3" onClick={() => setEditing(true)} disabled={readOnly}>
          {readOnly ? 'Modifica · non attiva in sola lettura' : 'Modifica'}
        </Button>
      </>
    )
  }
  const save = async () => {
    const digits = form.phone.replace(/\D/g, '').length
    if (form.phone.trim() && (digits < 8 || digits > 15)) { setError('Il numero di telefono non sembra completo: servono da 8 a 15 cifre.'); return }
    if (form.birth_date && (form.birth_date > dateLimits.birth.max || form.birth_date < dateLimits.birth.min)) { setError('La data di nascita non sembra giusta: controlla l\'anno.'); return }
    setBusy(true); setError(null)
    try {
      await savePersonalData(person.id, {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        phone: form.phone.trim() || null, birth_date: form.birth_date || null, ui_language: person.ui_language,
        gender: form.gender || null, address: form.address.trim() || null, city: form.city.trim() || null,
      })
      setEditing(false); onChanged(); say('Dati personali salvati')
    } catch (e) { setError(friendly(e)) } finally { setBusy(false) }
  }
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <Field label="Nome" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
      <Field label="Cognome" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
      <Field label="Telefono" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <Field label="Data di nascita" type="date" min={dateLimits.birth.min} max={dateLimits.birth.max} value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-soft">Sesso</span>
        <select className="h-12 w-full rounded-xl border border-line bg-card px-3 text-base" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="">Da indicare</option><option value="M">M</option><option value="F">F</option>
        </select>
      </label>
      <Field label="Indirizzo di residenza" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <Field label="Città di residenza" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</Button>
      <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Annulla</Button>
    </form>
  )
}

/** Rilascio non nel futuro e scadenza non prima del rilascio: detto subito, con parole semplici. */
function datesOk(v: Record<string, string | boolean>) {
  const issued = str(v.issued_on), expires = str(v.expires_on)
  if (issued && issued > new Date().toISOString().slice(0, 10)) throw new Error('La data di rilascio è nel futuro: controlla l\'anno.')
  if (issued && expires && expires < issued) throw new Error('La data di scadenza viene prima della data di rilascio: controlla le due date.')
}

function alertError(e: unknown) { console.error(e); window.alert(friendly(e, 'aprire il file')) }
