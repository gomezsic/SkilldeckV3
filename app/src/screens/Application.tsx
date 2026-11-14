import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { Button, Field } from '../components/ui'
import {
  type ApplicationData, type Options, type Track, BOATS as BOATS_BASE, CONTACT, CONTEXTS as CONTEXTS_BASE, COOKING, DEFAULT_SETTINGS, EXPERIENCE as EXPERIENCE_BASE, LANGUAGES as LANGUAGES_BASE, MAX_LANGUAGES, PREFIXES,
  SKILL_GROUPS as SKILL_GROUPS_BASE, SKILL_LEVELS, emptyApplication, fmtSlot, fmtSlotTime, freeSlots, loadOptions, passwordProblem, problems, readDraft, saveDraft,
  submitApplication, toPayload,
} from '../lib/application'
import { type Option, grouped, loadLists, pick } from '../lib/lists'
import { friendly, useUnsaved } from '../lib/friendly'
import { supabase } from '../lib/supabase'

const GOOGLE_ON = import.meta.env.VITE_GOOGLE_LOGIN === '1'
const card = 'rounded-2xl border border-line bg-card p-4 space-y-3'
const selectCls = 'h-12 w-full rounded-xl border border-line bg-card px-3 text-base'
const yearsAgo = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10) }

function Pick({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium ${on ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{children}</button>
}
function Check({ on, label, hint, onChange }: { on: boolean; label: string; hint?: string | null; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-start gap-3 py-1.5 text-sm">
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="font-medium">{label}</span>{hint && <span className="block text-xs text-ink-soft">{hint}</span>}</span>
    </label>
  )
}
function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-soft">{label}</span>
      <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  )
}
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

/** Il modulo di candidatura: gli stessi dati del modulo attuale, con la richiesta del colloquio conoscitivo. */
export default function Application({ session, kind, firstError, onDone }: { session: Session | null; kind: 'skipper' | 'crew'; firstError?: string | null; onDone: () => void }) {
  const [a, setA] = useState<ApplicationData>(() => {
    const d = readDraft()
    const fits = d && (kind === 'crew' ? d.track === 'crew' : d.track !== 'crew')
    return fits ? { ...emptyApplication(d.track), ...d, privacy: false } : emptyApplication(kind === 'crew' ? 'crew' : 'skipper')
  })
  const [touched, setTouched] = useState(false)
  // Gli elenchi sono quelli che l'amministratore modifica in Impostazioni; se non si riescono a leggere restano quelli di base.
  const [lists, setLists] = useState<Option[]>([])
  useEffect(() => { loadLists().then(setLists).catch(() => setLists([])) }, [])
  const fromList = (list: string, base: string[]) => { const l = pick(lists, list).map((o) => o.label); return l.length ? l : base }
  const LANGUAGES = fromList('language', LANGUAGES_BASE), EXPERIENCE = fromList('experience_years', EXPERIENCE_BASE), CONTEXTS = fromList('experience_context', CONTEXTS_BASE)
  const BOATS = fromList('crew_boat', BOATS_BASE)
  const crewSkills = pick(lists, 'crew_skill')
  const SKILL_GROUPS = crewSkills.length ? grouped(crewSkills).map((g) => ({ title: g.group ?? 'Altre competenze', items: g.items.map((o) => o.label) })) : SKILL_GROUPS_BASE
  const [email, setEmail] = useState(''); const [email2, setEmail2] = useState('')
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [options, setOptions] = useState<Options | null>(null)
  const [optError, setOptError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>(firstError ? [firstError] : [])
  const [sent, setSent] = useState<null | 'confirm-email'>(null)
  const [otherLang, setOtherLang] = useState(false)
  useUnsaved(touched && !sent)

  const set = <K extends keyof ApplicationData>(k: K, v: ApplicationData[K]) => { setTouched(true); setA((p) => { const n = { ...p, [k]: v }; saveDraft(n); return n }) }
  useEffect(() => { loadOptions().then(setOptions).catch((e) => setOptError(friendly(e, 'leggere le disponibilità per il colloquio'))) }, [])

  const isCrew = a.track === 'crew'
  const titles = (options?.titles ?? []).filter((t) => (isCrew ? t.crew : t.skipper))
  const commandTitles = titles.filter((t) => t.category === 'command')
  const days = useMemo(() => freeSlots(options?.settings ?? DEFAULT_SETTINGS, options?.busy ?? []), [options])
  const [day, setDay] = useState<string | null>(null)
  const openDay = days.find((d) => d.day === day) ?? days[0]

  const send = async () => {
    const list = problems(a)
    if (!session) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) list.push('Scrivi un indirizzo email valido.')
      else if (email.trim().toLowerCase() !== email2.trim().toLowerCase()) list.push('Le due email non sono uguali: controllale.')
      const p = passwordProblem(pw); if (p) list.push(p); else if (pw !== pw2) list.push('Le due password non sono uguali: riscrivile.')
    }
    setErrors(list)
    if (list.length) { document.getElementById('problemi')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    setBusy(true)
    try {
      const payload = toPayload(a)
      if (session) { await submitApplication(payload); setTouched(false); onDone(); return }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: window.location.origin, data: { application: payload } } })
      if (error) {
        const m = error.message.toLowerCase()
        setErrors([m.includes('already') ? 'Con questa email esiste già un accesso: torna indietro e premi "Entra".'
          : m.includes('is invalid') ? 'Questo indirizzo email non viene accettato. Controlla di averlo scritto bene, oppure prova con un altro indirizzo.'
          : m.includes('rate limit') ? 'In questo momento non riusciamo a mandare altre email di conferma: è un limite del servizio di posta e si sblocca entro un\'ora. Quello che hai scritto resta salvato: riprova più tardi oppure usa "Continua con Google".'
          : m.includes('security purposes') ? 'Hai appena fatto una richiesta: aspetta un minuto e riprova.'
          : friendly(error, 'creare il tuo accesso')])
      } else if (data.user && data.user.identities?.length === 0) setErrors(['Con questa email esiste già un accesso: torna indietro e premi "Entra".'])
      else if (!data.session) { setTouched(false); setSent('confirm-email') }
      else setTouched(false) // con la sessione attiva l'invio prosegue da solo
    } catch (e) { setErrors([friendly(e, 'inviare la candidatura')]) }
    setBusy(false)
  }
  const google = async () => {
    saveDraft(a)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setErrors([friendly(error, 'entrare con Google')])
  }

  if (sent) return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10 text-center">
      <img src="/logo.png" alt="SkillDeck Pro" className="mx-auto h-auto w-48" />
      <h1 className="mt-6 text-2xl font-semibold">Manca un solo passo</h1>
      <p className="mt-2 text-sm text-ink-soft">Ti abbiamo scritto a <span className="font-semibold text-ink">{email.trim()}</span>. Apri il messaggio e premi il link di conferma: la tua candidatura parte in quel momento, senza dover ricompilare nulla.</p>
      <p className="mt-3 text-sm text-ink-soft">Se non lo trovi, guarda nella posta indesiderata.</p>
      <a href="#/" className="mt-6 block"><Button variant="ghost">Torna all'accesso</Button></a>
    </main>
  )

  const langNames = a.languages.map((l) => l.name)
  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <a href={session ? '#/' : `#/diventa-${kind}`} className="flex items-center gap-2 text-sm font-semibold text-ink"><span aria-hidden>‹</span><img src="/logo-mark.png" alt="" className="h-8 w-8" />SkillDeck Pro</a>
          {session && <button type="button" className="text-sm font-medium text-sea" onClick={() => void supabase.auth.signOut()}>Esci</button>}
        </div>
      </header>
      <form className="mx-auto max-w-2xl space-y-3 px-4 py-6" noValidate onSubmit={(e) => { e.preventDefault(); void send() }}>
        <div>
          <h1 className="text-2xl font-semibold">{isCrew ? 'Candidatura Crew Assistant / Staff di bordo' : 'Candidatura Skipper'}</h1>
          <p className="mt-1 text-sm text-ink-soft">Bastano pochi minuti. Quello che scrivi resta salvato su questo dispositivo finché non invii, così puoi riprendere più tardi. I campi senza la scritta "facoltativo" sono obbligatori.</p>
        </div>

        {!isCrew && (
          <section className={card}>
            <h2 className="text-base font-semibold">Percorso</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['skipper', 'co_skipper'] as Track[]).map((t) => <Pick key={t} on={a.track === t} onClick={() => set('track', t)}>{t === 'skipper' ? 'Skipper' : 'Coskipper'}</Pick>)}
            </div>
          </section>
        )}

        <section className={card}>
          <h2 className="text-base font-semibold">I tuoi dati</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" autoComplete="given-name" value={a.first_name} onChange={(e) => set('first_name', e.target.value)} />
            <Field label="Cognome" autoComplete="family-name" value={a.last_name} onChange={(e) => set('last_name', e.target.value)} />
            <Field label="Data di nascita" type="date" min="1925-01-01" max={yearsAgo(16)} value={a.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
            <fieldset className="min-w-0">
              <legend className="mb-1 text-sm font-medium text-ink-soft">Sesso</legend>
              <div className="grid grid-cols-2 gap-2">
                <Pick on={a.gender === 'M'} onClick={() => set('gender', 'M')}>M</Pick>
                <Pick on={a.gender === 'F'} onClick={() => set('gender', 'F')}>F</Pick>
              </div>
            </fieldset>
            <Field label="Indirizzo di residenza" autoComplete="street-address" value={a.address} onChange={(e) => set('address', e.target.value)} />
            <Field label="Città di residenza" autoComplete="address-level2" value={a.city} onChange={(e) => set('city', e.target.value)} />
            <Select label="Prefisso" value={a.prefix} onChange={(v) => set('prefix', v)}>
              {PREFIXES.map(([code, country]) => <option key={code} value={code}>{country} ({code})</option>)}
            </Select>
            <Field label="Telefono" type="tel" inputMode="tel" autoComplete="tel-national" value={a.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </section>

        {!session && (
          <section className={card}>
            <h2 className="text-base font-semibold">Il tuo accesso</h2>
            <p className="text-sm text-ink-soft">Con questa email e questa password entrerai in SkillDeck Pro.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => { setTouched(true); setEmail(e.target.value) }} />
              <Field label="Conferma email" type="email" autoComplete="email" value={email2} onChange={(e) => setEmail2(e.target.value)} />
              <Field label="Password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <Field label="Ripeti la password" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {email2 !== '' && email.trim().toLowerCase() !== email2.trim().toLowerCase() && <p className="text-sm text-warn">Le due email non sono ancora uguali.</p>}
            {pw !== '' && passwordProblem(pw) && <p className="text-sm text-warn">{passwordProblem(pw)}</p>}
            {pw2 !== '' && pw !== pw2 && <p className="text-sm text-warn">Le due password non sono ancora uguali.</p>}
            <p className="text-xs text-ink-soft">La password: almeno 8 caratteri, con una maiuscola, un numero e un simbolo.</p>
            {GOOGLE_ON && (
              <div className="border-t border-line pt-3">
                <p className="mb-2 text-sm text-ink-soft">Preferisci non creare una password? Entra con Google: ritrovi il modulo com'è adesso e lo invii da lì.</p>
                <Button type="button" variant="ghost" onClick={() => void google()}>Continua con Google</Button>
              </div>
            )}
          </section>
        )}

        <section className={card}>
          <h2 className="text-base font-semibold">Lingue</h2>
          <Select label="Lingua madre" value={a.mother_tongue} onChange={(v) => set('mother_tongue', v)}>
            <option value="">Scegli…</option>
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </Select>
          <div>
            <p className="mb-1 text-sm font-medium text-ink-soft">Altre lingue parlate (facoltativo)</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.filter((l) => l !== a.mother_tongue).map((l) => (
                <Pick key={l} on={langNames.includes(l)} onClick={() => set('languages', langNames.includes(l) ? a.languages.filter((x) => x.name !== l) : a.languages.length >= MAX_LANGUAGES ? a.languages : [...a.languages, { name: l, level: 'elementare' }])}>{l}</Pick>
              ))}
              <Pick on={otherLang} onClick={() => { setOtherLang(true); if (a.languages.length < MAX_LANGUAGES) set('languages', [...a.languages, { name: '', level: 'elementare' }]) }}>Altra…</Pick>
            </div>
            {a.languages.length > 0 && (
              <ul className="mt-3 space-y-2">
                {a.languages.map((l, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    {LANGUAGES.includes(l.name) ? <span className="min-w-28 text-sm font-medium">{l.name}</span>
                      : <input aria-label="Nome della lingua" placeholder="Quale lingua?" value={l.name} onChange={(e) => set('languages', a.languages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="h-11 w-40 rounded-xl border border-line bg-card px-3 text-base" />}
                    <Pick on={l.level === 'elementare'} onClick={() => set('languages', a.languages.map((x, j) => (j === i ? { ...x, level: 'elementare' } : x)))}>Elementare</Pick>
                    <Pick on={l.level === 'certificato'} onClick={() => set('languages', a.languages.map((x, j) => (j === i ? { ...x, level: 'certificato' } : x)))}>Certificato</Pick>
                    <button type="button" className="h-11 px-2 text-sm font-medium text-sea" onClick={() => set('languages', a.languages.filter((_, j) => j !== i))}>Togli</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold">Esperienza</h2>
          <Select label={isCrew ? 'Anni di esperienza a bordo o a terra (facoltativo)' : 'Anni di esperienza (facoltativo)'} value={a.experience_years} onChange={(v) => set('experience_years', v)}>
            <option value="">Scegli…</option>
            {EXPERIENCE.map((x) => <option key={x}>{x}</option>)}
          </Select>
          {!isCrew && (
            <Select label="Titolo di comando (facoltativo)" value={a.command_title} onChange={(v) => set('command_title', v)}>
              <option value="">Nessuno</option>
              {commandTitles.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </Select>
          )}
          {isCrew && (
            <>
              <fieldset className="min-w-0">
                <legend className="mb-1 text-sm font-medium text-ink-soft">Dove hai maturato esperienza (facoltativo)</legend>
                <div className="flex flex-wrap gap-2">{CONTEXTS.map((c) => <Pick key={c} on={a.experience_contexts.includes(c)} onClick={() => set('experience_contexts', toggle(a.experience_contexts, c))}>{c}</Pick>)}</div>
              </fieldset>
              <fieldset className="min-w-0">
                <legend className="mb-1 text-sm font-medium text-ink-soft">Tipi di barca (facoltativo)</legend>
                <div className="flex flex-wrap gap-2">{BOATS.map((c) => <Pick key={c} on={a.boat_types.includes(c)} onClick={() => set('boat_types', toggle(a.boat_types, c))}>{c}</Pick>)}</div>
              </fieldset>
            </>
          )}
        </section>

        {isCrew && (
          <section className={card}>
            <h2 className="text-base font-semibold">Competenze (facoltativo)</h2>
            <p className="text-sm text-ink-soft">Tocca una competenza per aggiungerla, poi indica il tuo livello.</p>
            {SKILL_GROUPS.map((g) => (
              <fieldset key={g.title} className="min-w-0">
                <legend className="mb-1 text-sm font-semibold">{g.title}</legend>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((s) => {
                    const mine = a.skills.find((x) => x.name === s)
                    return <Pick key={s} on={!!mine} onClick={() => set('skills', mine ? a.skills.filter((x) => x.name !== s) : [...a.skills, { name: s, level: 'help' }])}>{s}</Pick>
                  })}
                </div>
                {a.skills.filter((x) => g.items.includes(x.name)).map((x) => (
                  <div key={x.name} className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="min-w-36 text-sm font-medium">{x.name}</span>
                    {(Object.keys(SKILL_LEVELS) as (keyof typeof SKILL_LEVELS)[]).map((lv) => (
                      <Pick key={lv} on={x.level === lv} onClick={() => set('skills', a.skills.map((y) => (y.name === x.name ? { ...y, level: lv } : y)))}>{SKILL_LEVELS[lv]}</Pick>
                    ))}
                  </div>
                ))}
                {g.title === 'Cucina' && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Select label="Livello in cucina" value={a.cooking_level} onChange={(v) => set('cooking_level', v)}>
                      <option value="">Scegli…</option>
                      {Object.entries(COOKING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                    <Field label="Tipo di cucina" placeholder="Es. mediterranea, vegetariana" value={a.cooking_type} onChange={(e) => set('cooking_type', e.target.value)} />
                  </div>
                )}
              </fieldset>
            ))}
          </section>
        )}

        <section className={card}>
          <h2 className="text-base font-semibold">Certificazioni (facoltativo)</h2>
          <p className="text-sm text-ink-soft">Spunta quelle che possiedi. I file li caricherai dopo, dal tuo profilo.</p>
          {!options && !optError && <p className="text-sm text-ink-soft">Carico l'elenco…</p>}
          {optError && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{optError} Ricarica la pagina: quello che hai scritto resta salvato.</p>}
          <div className="grid gap-x-4 sm:grid-cols-2">
            {titles.map((t) => <Check key={t.code} on={a.certifications.includes(t.code)} label={t.name} hint={t.issuer} onChange={() => set('certifications', toggle(a.certifications, t.code))} />)}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold">Raccontaci di te</h2>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-soft">Chi sei, cosa hai fatto in mare, perché vuoi lavorare con noi.</span>
            <textarea rows={6} maxLength={2000} value={a.about_me} onChange={(e) => set('about_me', e.target.value)} className="w-full rounded-xl border border-line bg-card p-3 text-base" />
            <span className={`mt-1 block text-right text-xs ${a.about_me.length > 1900 ? 'text-warn' : 'text-ink-soft'}`}>{a.about_me.length} di 2.000 caratteri</span>
          </label>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold">Colloquio conoscitivo</h2>
          <p className="text-sm text-ink-soft">Dicci come preferisci essere contattato e scegli da una a cinque disponibilità. Gli orari sono quelli italiani. Ti confermeremo noi quale.</p>
          <fieldset className="min-w-0">
            <legend className="mb-1 text-sm font-medium text-ink-soft">Come preferisci essere contattato</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CONTACT) as (keyof typeof CONTACT)[]).map((c) => <Pick key={c} on={a.contact_preference === c} onClick={() => set('contact_preference', c)}>{CONTACT[c]}</Pick>)}
            </div>
          </fieldset>
          {days.length === 0 ? <p className="text-sm text-ink-soft">{options ? 'In questo momento non ci sono fasce libere: riprova tra qualche giorno.' : 'Carico le disponibilità…'}</p> : (
            <>
              <fieldset className="min-w-0">
                <legend className="mb-1 text-sm font-medium text-ink-soft">Giorno</legend>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {days.map((d) => {
                    const n = d.slots.filter((s) => a.preferred_slots.includes(s)).length
                    return <button key={d.day} type="button" aria-pressed={openDay?.day === d.day} onClick={() => setDay(d.day)} className={`min-h-11 shrink-0 rounded-xl border px-3 py-2 text-sm font-medium capitalize ${openDay?.day === d.day ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{d.label}{n > 0 && ` · ${n}`}</button>
                  })}
                </div>
              </fieldset>
              {openDay && (
                <fieldset className="min-w-0">
                  <legend className="mb-1 text-sm font-medium text-ink-soft capitalize">Orari di {openDay.label}</legend>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {openDay.slots.map((s) => {
                      const on = a.preferred_slots.includes(s); const full = !on && a.preferred_slots.length >= 5
                      return <button key={s} type="button" aria-pressed={on} disabled={full} onClick={() => set('preferred_slots', toggle(a.preferred_slots, s).sort())} className={`h-11 rounded-xl border text-sm font-medium tabular-nums disabled:opacity-40 ${on ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{fmtSlotTime(s)}</button>
                    })}
                  </div>
                </fieldset>
              )}
              <div className="rounded-xl bg-sand p-3 text-sm">
                <p className="font-semibold">Le tue disponibilità: {a.preferred_slots.length} di 5</p>
                {a.preferred_slots.length === 0 ? <p className="text-ink-soft">Nessuna ancora: tocca un orario qui sopra.</p> : (
                  <ul className="mt-1 space-y-1">
                    {a.preferred_slots.map((s) => (
                      <li key={s} className="flex items-center justify-between gap-2"><span className="capitalize">{fmtSlot(s)}</span><button type="button" className="font-medium text-sea" onClick={() => set('preferred_slots', a.preferred_slots.filter((x) => x !== s))}>Togli</button></li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>

        <section className={card}>
          <Check on={a.privacy} label="Ho letto l'informativa sulla privacy e acconsento al trattamento dei miei dati personali." onChange={(v) => set('privacy', v)} />
          {errors.length > 0 && (
            <div id="problemi" role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
              <p className="font-semibold">{errors.length === 1 ? 'Manca ancora una cosa:' : `Mancano ancora ${errors.length} cose:`}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          <Button type="submit" disabled={busy}>{busy ? 'Invio in corso…' : 'Invia la candidatura'}</Button>
          <p className="text-center text-xs text-ink-soft">
            {isCrew ? <a className="font-medium text-sea" href="#/candidatura/skipper">Vuoi candidarti come Skipper? Cambia modulo</a>
              : <a className="font-medium text-sea" href="#/candidatura/crew">Vuoi candidarti come Crew Assistant / Staff di bordo? Cambia modulo</a>}
          </p>
        </section>
      </form>
    </div>
  )
}
