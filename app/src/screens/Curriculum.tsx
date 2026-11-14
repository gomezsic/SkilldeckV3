import { useEffect, useState } from 'react'
import { addRow, removeSkill, saveOne, setSkills } from '../lib/deck'
import { friendly, say, useUnsaved } from '../lib/friendly'
import { type Option, grouped, loadLists, pick } from '../lib/lists'
import type { Deck, Profile } from '../lib/types'

const emptyProfile: Profile = { description: null, objective: null, smoker: null, engagement_types: [], sought_roles: [], availability: [], tax_positions: [], min_daily_rate: null }
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-sand px-3 py-1.5 text-sm">{children}</span>
}
/** Elenco in riga, separato da punti: occupa molto meno dei bottoni. Oltre le prime voci compare "+N". */
function Inline({ items, max = 7 }: { items: string[]; max?: number }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, max)
  return (
    <p className="text-sm leading-snug">
      {shown.join(' · ')}
      {items.length > max && <button type="button" className="ml-1.5 text-xs font-semibold text-sea" onClick={() => setAll(!all)}>{all ? 'meno' : `+${items.length - max}`}</button>}
    </p>
  )
}
function Clamp({ text }: { text: string }) {
  const [all, setAll] = useState(false)
  const long = text.length > 130
  return <p className="text-sm leading-snug whitespace-pre-wrap">{all || !long ? text : `${text.slice(0, 120).trimEnd()}…`}{long && <button type="button" className="ml-1.5 text-xs font-semibold text-sea" onClick={() => setAll(!all)}>{all ? 'meno' : 'leggi tutto'}</button>}</p>
}
function Choice({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-9 rounded-full border px-3 py-1 text-[13px] font-medium ${on ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>{children}</button>
}
/** Un blocco del curriculum: titolo, contenuto in lettura, e "Modifica" che apre le scelte. */
function Block({ title, hint, empty, filled, readOnly, dirty, onSave, onCancel, view, children }: {
  title: string; hint?: string; empty: string; filled: boolean; readOnly: boolean; dirty: boolean
  onSave: () => Promise<void>; onCancel: () => void; view: React.ReactNode; children: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  useUnsaved(editing && dirty)
  const save = async () => {
    setBusy(true); setError(null)
    try { await onSave(); setEditing(false); say(`${title}: salvato`) } catch (e) { setError(friendly(e)) } finally { setBusy(false) }
  }
  if (!editing) return (
    <div className="grid grid-cols-[5.25rem_1fr_auto] items-baseline gap-x-2 border-t border-line py-2 first:border-t-0 sm:grid-cols-[9rem_1fr_auto]">
      <h3 className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">{title}</h3>
      <div className="min-w-0">{filled ? view : <p className="text-sm text-ink-soft">{empty}</p>}</div>
      {!readOnly ? (
        <button type="button" aria-label={`${filled ? 'Modifica' : 'Compila'}: ${title}`} className="-my-1 grid h-9 w-9 place-items-center rounded-full text-sea hover:bg-sea-soft" onClick={() => setEditing(true)}>
          {filled ? <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden><path d="M4 16l.8-3.4L13.6 3.8a1.4 1.4 0 012 0l.6.6a1.4 1.4 0 010 2L7.4 15.2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            : <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>}
        </button>
      ) : <span />}
    </div>
  )
  return (
    <section className="my-2 rounded-xl border border-sea/40 bg-sand p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 space-y-3">
        {hint && <p className="text-sm text-ink-soft">{hint}</p>}
        {children}
        {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="h-10 rounded-lg border border-line bg-card px-4 text-sm font-semibold" onClick={() => { onCancel(); setEditing(false); setError(null) }}>Annulla</button>
          <button type="button" disabled={busy} className="h-10 rounded-lg bg-ink px-5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void save()}>{busy ? 'Salvo…' : 'Salva'}</button>
        </div>
      </div>
    </section>
  )
}

/** Blocco a scelte multiple salvato come "voci" della persona (zone, competenze, barche, hobby, sport). */
function SkillBlock({ deck, kind, list, title, hint, empty, lists, readOnly, onChanged }: {
  deck: Deck; kind: string; list: string; title: string; hint: string; empty: string; lists: Option[]; readOnly: boolean; onChanged: () => void
}) {
  const mine = deck.skills.filter((s) => s.kind === kind).map((s) => s.value)
  const [sel, setSel] = useState<string[]>(mine)
  const [other, setOther] = useState('')
  useEffect(() => { setSel(mine) }, [mine.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const options = pick(lists, list)
  const extra = sel.filter((v) => !options.some((o) => o.label === v))
  const groups = grouped(options)
  return (
    <Block title={title} hint={hint} empty={empty} filled={mine.length > 0} readOnly={readOnly} dirty={sel.join('|') !== mine.join('|')}
      onSave={async () => { await setSkills(deck.person.id, kind, mine, sel); onChanged() }} onCancel={() => { setSel(mine); setOther('') }}
      view={<Inline items={mine} />}>
      {groups.map((g) => (
        <fieldset key={g.group ?? '-'} className="min-w-0">
          {g.group && <legend className="mb-1.5 flex items-center gap-3 text-xs font-semibold text-ink-soft">{g.group}
            <button type="button" className="font-semibold text-sea" onClick={() => { const all = g.items.map((o) => o.label); setSel(all.every((v) => sel.includes(v)) ? sel.filter((v) => !all.includes(v)) : [...new Set([...sel, ...all])]) }}>{g.items.every((o) => sel.includes(o.label)) ? 'Togli tutte' : 'Tutte'}</button></legend>}
          <div className="flex flex-wrap gap-1.5">{g.items.map((o) => <Choice key={o.id} on={sel.includes(o.label)} onClick={() => setSel(toggle(sel, o.label))}>{o.label}</Choice>)}</div>
        </fieldset>
      ))}
      {extra.length > 0 && <div className="flex flex-wrap gap-2">{extra.map((v) => <Choice key={v} on onClick={() => setSel(toggle(sel, v))}>{v}</Choice>)}</div>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = other.trim(); if (v && !sel.includes(v)) setSel([...sel, v]); setOther('') }}>
        <input aria-label="Altro" placeholder="Altro: scrivi e premi Aggiungi" value={other} onChange={(e) => setOther(e.target.value)} maxLength={80} className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-base" />
        <button type="submit" className="h-10 rounded-lg border border-line bg-card px-4 text-sm font-semibold">Aggiungi</button>
      </form>
    </Block>
  )
}

/** Il curriculum dentro My Deck: si legge come una pagina, si modifica un blocco alla volta. */
export default function Curriculum({ deck, readOnly, onChanged }: { deck: Deck; readOnly: boolean; onChanged: () => void }) {
  const [lists, setLists] = useState<Option[]>([])
  useEffect(() => { loadLists().then(setLists).catch(() => setLists([])) }, []) // senza elenchi resta la lettura e l'aggiunta libera
  const saved = deck.profile ?? emptyProfile
  const [p, setP] = useState<Profile>(saved)
  useEffect(() => { setP(deck.profile ?? emptyProfile) }, [deck.profile])
  const saveProfile = async (patch: Partial<Profile>) => { await saveOne('person_profile', deck.person.id, patch); onChanged() }
  const changed = (...keys: (keyof Profile)[]) => keys.some((k) => JSON.stringify(p[k]) !== JSON.stringify(saved[k]))
  const reset = () => setP(saved)

  const languages = deck.skills.filter((s) => s.kind === 'language')
  const [lang, setLang] = useState(''); const [level, setLevel] = useState('')
  const langOptions = pick(lists, 'language').map((o) => o.label).filter((l) => !languages.some((x) => x.value === l))
  const levels = pick(lists, 'language_level').map((o) => o.label)
  const multi = (key: 'engagement_types' | 'sought_roles' | 'availability' | 'tax_positions', list: string, label: string) => (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-semibold text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-2">{[...pick(lists, list).map((o) => o.label), ...p[key].filter((v) => !pick(lists, list).some((o) => o.label === v))].map((v) => <Choice key={v} on={p[key].includes(v)} onClick={() => setP({ ...p, [key]: toggle(p[key], v) })}>{v}</Choice>)}</div>
    </fieldset>
  )
  const seeking = [
    ['Tipologia di ingaggio', saved.engagement_types], ['Ruolo', saved.sought_roles], ['Disponibilità', saved.availability], ['Posizione contributiva', saved.tax_positions],
  ] as const

  const validTitles = deck.titles.filter((t) => !t.archived_at && t.status !== 'rejected' && t.status !== 'draft').map((t) => t.name_it)
  const log = deck.logbook.reduce((a, e) => ({ miles: a.miles + Number(e.miles ?? 0), days: a.days + (e.days ?? 0), nights: a.nights + (e.nights ?? 0) }), { miles: 0, days: 0, nights: 0 })
  const facts = [[Math.round(log.miles).toLocaleString('it-IT'), 'miglia'], [String(log.days), 'giorni in mare'], [String(log.nights), 'notti'], [String(validTitles.length), validTitles.length === 1 ? 'titolo' : 'titoli']]

  return (
    <div>
      <dl className="mb-2 grid grid-cols-4 divide-x divide-line rounded-xl bg-sand py-2 text-center">
        {facts.map(([n, label]) => <div key={label} className="px-1"><dd className="text-lg leading-tight font-semibold tabular-nums">{n}</dd><dt className="text-[11px] leading-tight text-ink-soft">{label}</dt></div>)}
      </dl>
      {validTitles.length > 0 && (
        <div className="grid grid-cols-[5.25rem_1fr_auto] items-baseline gap-x-2 py-2 sm:grid-cols-[9rem_1fr_auto]">
          <h3 className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">Titoli</h3>
          <Inline items={validTitles} max={5} /><span className="w-9" />
        </div>
      )}
      <div className={validTitles.length > 0 ? 'border-t border-line' : ''}>
      <Block title="Chi sono" empty="Presentati in poche righe: è la prima cosa che legge chi valuta il tuo profilo." filled={!!saved.description} readOnly={readOnly} dirty={changed('description')}
        hint="Capacità nautiche e veliche, predisposizione al comando, capacità con le persone, il tuo carattere."
        onSave={() => saveProfile({ description: p.description?.trim() || null })} onCancel={reset}
        view={<Clamp text={saved.description ?? ''} />}>
        <textarea rows={6} maxLength={3000} value={p.description ?? ''} onChange={(e) => setP({ ...p, description: e.target.value })} className="w-full rounded-xl border border-line bg-card p-3 text-base" />
        <p className="text-right text-xs text-ink-soft">{(p.description ?? '').length} di 3.000 caratteri</p>
      </Block>

      <Block title="Lingue" empty="Aggiungi le lingue che parli." filled={languages.length > 0} readOnly={readOnly} dirty={!!lang}
        onSave={async () => { if (lang) { await addRow('person_skill', { person_id: deck.person.id, kind: 'language', value: lang, level: level || null }); setLang(''); setLevel(''); onChanged() } }} onCancel={() => { setLang(''); setLevel('') }}
        view={<Inline items={languages.map((l) => `${l.value}${l.level ? ` (${l.level})` : ''}`)} />}>
        <div className="flex flex-wrap gap-1.5">
          {languages.map((l) => <Tag key={l.value}>{l.value}{l.level ? ` · ${l.level}` : ''}<button type="button" aria-label={`Togli ${l.value}`} className="ml-2 font-semibold text-sea" onClick={() => void removeSkill(deck.person.id, 'language', l.value).then(onChanged).catch((e) => window.alert(friendly(e)))}>Togli</button></Tag>)}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Aggiungi una lingua</span>
            <select className="h-12 w-full rounded-xl border border-line bg-card px-3 text-base" value={lang} onChange={(e) => setLang(e.target.value)}><option value="">Scegli…</option>{langOptions.map((l) => <option key={l}>{l}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Livello</span>
            <select className="h-12 w-full rounded-xl border border-line bg-card px-3 text-base" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">Scegli…</option><option>Madrelingua</option>{levels.map((l) => <option key={l}>{l}</option>)}</select></label>
        </div>
      </Block>

      <SkillBlock deck={deck} kind="area" list="zone" title="Zone" hint="Tocca le zone in cui hai navigato davvero." empty="Indica dove hai esperienza di navigazione." lists={lists} readOnly={readOnly} onChanged={onChanged} />
      <SkillBlock deck={deck} kind="boat_type" list="boat_category" title="Barche" hint="Le tipologie di barca su cui hai esperienza." empty="Indica su quali barche hai esperienza." lists={lists} readOnly={readOnly} onChanged={onChanged} />
      <SkillBlock deck={deck} kind="technical" list="technical_skill" title="Competenze" hint="Scegli solo quelle in cui ti senti sicuro." empty="Indica le tue competenze nautiche." lists={lists} readOnly={readOnly} onChanged={onChanged} />
      <SkillBlock deck={deck} kind="soft" list="soft_skill" title="Soft skills" hint="Come lavori con le persone a bordo." empty="Indica le tue competenze trasversali." lists={lists} readOnly={readOnly} onChanged={onChanged} />
      <SkillBlock deck={deck} kind="hobby" list="hobby" title="Hobby" hint="Aiutano a conoscerti e a comporre gli equipaggi." empty="Racconta cosa ti piace fare." lists={lists} readOnly={readOnly} onChanged={onChanged} />
      <SkillBlock deck={deck} kind="sport" list="sport" title="Sport" hint="Gli sport che pratichi." empty="Indica gli sport che pratichi." lists={lists} readOnly={readOnly} onChanged={onChanged} />

      <Block title="Fumatore" empty="Non indicato." filled={saved.smoker !== null} readOnly={readOnly} dirty={changed('smoker')}
        onSave={() => saveProfile({ smoker: p.smoker })} onCancel={reset} view={<p className="text-sm">{saved.smoker ? 'Sì' : 'No'}</p>}>
        <div className="flex gap-2"><Choice on={p.smoker === false} onClick={() => setP({ ...p, smoker: false })}>No</Choice><Choice on={p.smoker === true} onClick={() => setP({ ...p, smoker: true })}>Sì</Choice></div>
      </Block>

      <Block title="Obiettivo" empty="Scrivi cosa vuoi fare nel settore nautico." filled={!!saved.objective} readOnly={readOnly} dirty={changed('objective')}
        hint="Per esempio: ingaggi stagionali come skipper su imbarcazioni tra 15 e 20 metri."
        onSave={() => saveProfile({ objective: p.objective?.trim() || null })} onCancel={reset} view={<Clamp text={saved.objective ?? ''} />}>
        <textarea rows={3} maxLength={1500} value={p.objective ?? ''} onChange={(e) => setP({ ...p, objective: e.target.value })} className="w-full rounded-xl border border-line bg-card p-3 text-base" />
      </Block>

      <Block title="Cosa cerco" empty="Tipo di ingaggio, ruolo, disponibilità e compenso minimo." readOnly={readOnly}
        filled={seeking.some(([, v]) => v.length > 0) || saved.min_daily_rate !== null} dirty={changed('engagement_types', 'sought_roles', 'availability', 'tax_positions', 'min_daily_rate')}
        onSave={async () => {
          if (p.min_daily_rate !== null && (p.min_daily_rate < 0 || p.min_daily_rate > 5000)) throw new Error('Il compenso minimo giornaliero deve essere tra 0 e 5.000 euro: controlla la cifra.')
          await saveProfile({ engagement_types: p.engagement_types, sought_roles: p.sought_roles, availability: p.availability, tax_positions: p.tax_positions, min_daily_rate: p.min_daily_rate })
        }} onCancel={reset}
        view={<Inline max={12} items={[...seeking.flatMap(([, v]) => v), ...(saved.min_daily_rate !== null ? [`da ${saved.min_daily_rate} € netti al giorno`] : [])]} />}>
        {multi('engagement_types', 'engagement_type', 'Tipologia di ingaggio')}
        {multi('sought_roles', 'sought_role', 'Ruolo')}
        {multi('availability', 'availability', 'Disponibilità')}
        {multi('tax_positions', 'tax_position', 'Posizione contributiva')}
        <label className="block max-w-xs"><span className="mb-1 block text-xs font-semibold text-ink-soft">Compenso minimo giornaliero netto, in euro</span>
          <input type="number" inputMode="numeric" min={0} max={5000} step={10} value={p.min_daily_rate ?? ''} onChange={(e) => setP({ ...p, min_daily_rate: e.target.value === '' ? null : Number(e.target.value) })} className="h-12 w-full rounded-xl border border-line bg-card px-3 text-base" /></label>
      </Block>
      </div>
    </div>
  )
}
