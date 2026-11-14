import { useEffect, useRef, useState } from 'react'
import CropDialog from '../components/CropDialog'
import { Empty, Row } from '../components/ui'
import { addRow, openFile, saveOne, setPhoto, signedUrl, updateRow, uploadFile } from '../lib/deck'
import { ibanProblem, pecProblem, sdiProblem, taxCodeProblem, vatProblem } from '../lib/fiscal'
import { friendly, say } from '../lib/friendly'
import { fmtDate } from '../lib/labels'
import type { Deck } from '../lib/types'
import { ConfirmLink, MiniForm, dateLimits, str } from './DeckForms'

/** La foto del profilo: tonda, ritagliata quadrata. Senza foto restano le iniziali. */
export function PhotoAvatar({ deck, editable, onChanged }: { deck: Deck; editable: boolean; onChanged: () => void }) {
  const { person } = deck
  const [url, setUrl] = useState<string | null>(null)
  const [picked, setPicked] = useState<File | null>(null)
  const [busy, setBusy] = useState(false); const [problem, setProblem] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let alive = true
    if (!deck.photo_path) { setUrl(null); return }
    signedUrl(deck.photo_path).then((u) => { if (alive) setUrl(u) }).catch(() => { if (alive) setUrl(null) })
    return () => { alive = false }
  }, [deck.photo_path])

  const take = (f: File | undefined) => {
    setProblem(null)
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { setProblem('Per la foto del profilo serve un\'immagine JPG, PNG o WEBP. Le foto HEIC dell\'iPhone vanno prima convertite: basta inviarsela per email o fare uno screenshot.'); return }
    if (f.size > 25 * 1024 * 1024) { setProblem('La foto è troppo pesante: scegline una sotto i 25 MB.'); return }
    setPicked(f)
  }
  const save = async (f: File) => {
    setPicked(null); setBusy(true)
    try { await setPhoto(person.id, f); say('Foto del profilo salvata'); onChanged() }
    catch (e) { setProblem(friendly(e, 'salvare la foto')) } finally { setBusy(false) }
  }
  return (
    <div className="shrink-0">
      <div className="relative h-16 w-16">
        {url ? <img src={url} alt={`Foto di ${person.first_name} ${person.last_name}`} className="h-16 w-16 rounded-full object-cover ring-2 ring-white/30" />
          : <div aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-white/15 text-lg font-semibold">{person.first_name[0]}{person.last_name[0]}</div>}
        {editable && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()} aria-label={url ? 'Cambia la foto del profilo' : 'Aggiungi la foto del profilo'}
            className="absolute -right-1 -bottom-1 grid h-8 w-8 place-items-center rounded-full bg-white text-ink shadow">
            <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden><path d="M3 7h2.5l1.2-2h6.6l1.2 2H17v9H3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="10" cy="11.5" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { take(e.target.files?.[0]); e.target.value = '' }} />
      {busy && <p className="mt-1 text-xs text-white/75">Salvo…</p>}
      {problem && <p role="alert" className="absolute right-4 left-4 z-10 mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{problem} <button type="button" className="font-semibold underline" onClick={() => setProblem(null)}>Ho capito</button></p>}
      {picked && <CropDialog file={picked} square onCancel={() => setPicked(null)} onDone={(f) => void save(f)} />}
    </div>
  )
}

/** Lettere di referenza: titolo, chi l'ha scritta, data e il file. */
export function Letters({ deck, readOnly, onChanged }: { deck: Deck; readOnly: boolean; onChanged: () => void }) {
  const letters = (deck.letters ?? []).filter((l) => !l.archived_at)
  const fields = (l?: { title: string; issuer: string | null; issued_on: string | null }) => [
    { name: 'title', label: 'Titolo', required: true, placeholder: 'Per esempio: Referenza stagione 2026', initial: l?.title ?? '' },
    { name: 'issuer', label: 'Chi l\'ha scritta', required: true, placeholder: 'Persona o società', initial: l?.issuer ?? '' },
    { name: 'issued_on', label: 'Data della lettera', type: 'date' as const, required: true, initial: l?.issued_on ?? '', ...dateLimits.past },
  ]
  return (
    <>
      {letters.length === 0 ? <Empty>Carica qui le lettere di referenza di armatori, società o clienti: arricchiscono il tuo curriculum.</Empty> : (
        <ul className="divide-y divide-line">
          {letters.map((l) => (
            <li key={l.id} className="py-2.5">
              <p className="text-sm font-medium">{l.title}</p>
              <p className="text-xs text-ink-soft">{[l.issuer, l.issued_on ? fmtDate(l.issued_on) : null].filter(Boolean).join(' · ')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                {l.file_path && <button type="button" className="text-xs font-semibold text-sea" onClick={() => void openFile(l.file_path!).catch((e) => window.alert(friendly(e, 'aprire il file')))}>Apri il file</button>}
                {!readOnly && <MiniForm small open="Modifica" fields={fields(l)} onSave={async (v) => { await updateRow('reference_letter', l.id, { title: str(v.title), issuer: str(v.issuer), issued_on: str(v.issued_on) }); onChanged() }} />}
                {!readOnly && <ConfirmLink label="Togli" question="La tolgo dal profilo? Resta in archivio." yes="Sì, togli" onConfirm={async () => { await updateRow('reference_letter', l.id, { archived_at: new Date().toISOString() }); onChanged() }} />}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && <MiniForm open="Aggiungi una lettera di referenza" submit="Carica" done="Lettera caricata" fields={[...fields(), { name: 'file', label: 'File: PDF o foto, massimo 10 MB', type: 'file', required: true }]}
        onSave={async (v, file) => {
          const file_id = await uploadFile(deck.person.id, 'referenze', file!, 'reference_letter')
          await addRow('reference_letter', { person_id: deck.person.id, title: str(v.title), issuer: str(v.issuer), issued_on: str(v.issued_on), file_id }); onChanged()
        }} />}
    </>
  )
}

/** Dati fiscali: gli stessi della piattaforma di oggi, con i controlli sugli errori di battitura. */
export function Tax({ deck, readOnly, positions, onChanged }: { deck: Deck; readOnly: boolean; positions: string[]; onChanged: () => void }) {
  const t = deck.tax; const b = t?.billing_address ?? {}
  const regimes = [...new Set([...(t?.tax_regime ? [t.tax_regime] : []), ...positions])]
  const residence = [deck.person.address, deck.person.city].filter(Boolean).join(', ')
  return (
    <>
      <Row label="Codice fiscale" value={t?.no_tax_code ? 'Non ho un codice fiscale italiano' : t?.tax_code} />
      <Row label="Luogo di nascita" value={t?.birth_place} />
      <Row label="Posizione" value={t?.tax_regime} />
      <Row label="Partita IVA" value={t?.vat_number} />
      <Row label="Ragione sociale" value={t?.company_name} />
      <Row label="PEC" value={t?.pec} />
      <Row label="Codice SDI" value={t?.sdi_code} />
      <Row label="IBAN" value={t?.iban} />
      <Row label="Intestatario del conto" value={t?.account_holder} />
      <Row label="Indirizzo di fatturazione" value={t && t.billing_same === false ? [b.address, b.zip, b.city, b.province, b.country].filter(Boolean).join(', ') : residence ? `Come la residenza: ${residence}` : 'Come la residenza'} />
      {!readOnly && <MiniForm open="Modifica" done="Dati fiscali salvati" fields={[
        { name: 'tax_code', label: 'Codice fiscale', initial: t?.tax_code ?? '' },
        { name: 'no_tax_code', label: 'Non ho un codice fiscale italiano', type: 'checkbox', initial: !!t?.no_tax_code },
        { name: 'birth_place', label: 'Luogo di nascita', placeholder: 'Comune e provincia, oppure Stato estero', initial: t?.birth_place ?? '' },
        { name: 'tax_regime', label: 'Come vieni pagato', type: 'select', initial: t?.tax_regime ?? '', options: regimes.map((x) => ({ value: x, label: x })) },
        { name: 'vat_number', label: 'Partita IVA (se ce l\'hai)', initial: t?.vat_number ?? '' },
        { name: 'company_name', label: 'Ragione sociale (se fatturi come ditta o società)', initial: t?.company_name ?? '' },
        { name: 'pec', label: 'PEC (facoltativo)', initial: t?.pec ?? '' },
        { name: 'sdi_code', label: 'Codice SDI (facoltativo, 7 caratteri)', initial: t?.sdi_code ?? '' },
        { name: 'iban', label: 'IBAN', initial: t?.iban ?? '' },
        { name: 'account_holder', label: 'Intestatario del conto', initial: t?.account_holder ?? '' },
        { name: 'billing_same', label: 'L\'indirizzo di fatturazione è uguale alla residenza', type: 'checkbox', initial: t?.billing_same ?? true },
        { name: 'b_address', label: 'Indirizzo di fatturazione (solo se diverso)', initial: b.address ?? '' },
        { name: 'b_zip', label: 'CAP', initial: b.zip ?? '' },
        { name: 'b_city', label: 'Città', initial: b.city ?? '' },
        { name: 'b_province', label: 'Provincia', initial: b.province ?? '' },
        { name: 'b_country', label: 'Paese', initial: b.country ?? '' },
      ]} onSave={async (v) => {
        const code = str(v.tax_code)?.toUpperCase().replace(/\s/g, '') ?? null
        const vat = str(v.vat_number)?.replace(/\s/g, '').replace(/^IT/i, '') ?? null
        const iban = str(v.iban)?.replace(/\s+/g, '').toUpperCase() ?? null
        const pec = str(v.pec)?.toLowerCase() ?? null; const sdi = str(v.sdi_code)?.toUpperCase() ?? null
        if (v.no_tax_code && code) throw new Error('Hai scritto un codice fiscale e anche spuntato "Non ho un codice fiscale": lascia solo una delle due cose.')
        const problem = (code && taxCodeProblem(code)) || (vat && vatProblem(vat)) || (iban && ibanProblem(iban)) || (pec && pecProblem(pec)) || (sdi && sdiProblem(sdi))
        if (problem) throw new Error(problem)
        if (str(v.tax_regime)?.toLowerCase().includes('iva') && !vat) throw new Error('Hai indicato Partita IVA come posizione: scrivi anche il numero di partita IVA.')
        const same = !!v.billing_same
        if (!same && !(str(v.b_address) && str(v.b_city))) throw new Error('Per un indirizzo di fatturazione diverso servono almeno indirizzo e città.')
        if (str(v.b_zip) && !/^[A-Za-z0-9 -]{3,10}$/.test(str(v.b_zip)!)) throw new Error('Il CAP non sembra giusto: in Italia ha 5 cifre.')
        await saveOne('tax_profile', deck.person.id, {
          tax_code: code, no_tax_code: !!v.no_tax_code, birth_place: str(v.birth_place), tax_regime: str(v.tax_regime), vat_number: vat, company_name: str(v.company_name),
          pec, sdi_code: sdi, iban, account_holder: str(v.account_holder), billing_same: same,
          billing_address: same ? null : { address: str(v.b_address), zip: str(v.b_zip), city: str(v.b_city), province: str(v.b_province)?.toUpperCase(), country: str(v.b_country) },
        }); onChanged()
      }} />}
    </>
  )
}
