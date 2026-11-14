import { useEffect, useState } from 'react'
import { Button, Chip } from '../components/ui'
import { type MyInterview, CONTACT, MODALITY, fmtSlot, loadMyInterview } from '../lib/application'
import { capabilityLabel, daysTo, fmtDate, requirementLabel, stepLabel } from '../lib/labels'
import type { Deck, StepKind } from '../lib/types'

const WARNING_DAYS = 60
const stepHelp: Record<StepKind, string> = {
  interview: 'Ti contattiamo noi per fissare il colloquio.',
  test: 'Ti arriva il link del test quando viene aperta la sessione.',
  career: 'Segui la tua Career: date e valutazioni arrivano dal tuo formatore.',
  documents: 'Carica i titoli che mancano: li trovi in My Deck.',
  ready_confirmation: 'Hai completato il percorso. Aspetti la conferma finale.',
}

interface Card { eyebrow: string; title: string; text?: string; button?: string; tone: 'ink' | 'warn' }
interface Notice { text: string; tone: 'warn' | 'bad' | 'neutral' }

/** Today risponde a una domanda sola: cosa devo fare adesso. Una scheda, un pulsante, al massimo tre avvisi. */
export default function Today({ deck, demo, onOpenDeck }: { deck: Deck; demo?: boolean; onOpenDeck: () => void }) {
  const { person } = deck
  const [interview, setInterview] = useState<MyInterview | null>(null)
  useEffect(() => {
    if (demo || person.status !== 'registered') return
    loadMyInterview().then(setInterview).catch(() => setInterview(null)) // senza il colloquio la pagina resta comunque utile
  }, [demo, person.status, person.id])
  const isSkipper = person.family === 'skipper'
  const plan = deck.plans.find((p) => p.status === 'active')
  const open = plan?.steps.find((s) => s.status === 'todo' || s.status === 'in_progress')
  const required = plan?.steps.filter((s) => s.status !== 'not_required') ?? []
  const missing = isSkipper ? deck.compliance.filter((c) => !c.covered) : []

  const dated = [
    ...deck.titles.filter((t) => t.status === 'declared' || t.status === 'verified').map((t) => ({ name: t.name_it, on: t.expires_on })),
    ...deck.identity.map((d) => ({ name: 'Documento d\'identità', on: d.expires_on })),
    ...deck.insurance.map((d) => ({ name: d.kind, on: d.expires_on })),
  ].map((x) => ({ ...x, days: daysTo(x.on) })).filter((x) => x.days !== null && x.days <= WARNING_DAYS)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

  const filled = [
    !!person.phone && !!person.birth_date, deck.titles.length > 0, deck.identity.length > 0,
    deck.skills.length > 0, !!deck.tax?.tax_code, !!deck.preferences?.privacy_consent_at,
  ].filter(Boolean).length

  let card: Card
  const notices: Notice[] = []

  if (person.family === 'admin') {
    card = { eyebrow: 'Amministratore', title: 'La sala di controllo arriva qui.', text: 'Nuove registrazioni, persone in percorso, coda "Pronti per Ready" e titoli da verificare.', tone: 'ink' }
  } else if (person.status === 'registered') {
    card = interview?.status === 'scheduled' && interview.scheduled_start
      ? { eyebrow: 'Colloquio fissato', title: `${fmtSlot(interview.scheduled_start).replace(/^./, (c) => c.toUpperCase())}.`, text: `${MODALITY[interview.modality as keyof typeof MODALITY] ?? 'Colloquio'} · circa ${interview.duration_minutes} minuti · orario italiano.${interview.location ? ` ${interview.location}` : ''}`, button: 'Completa il profilo', tone: 'ink' }
      : interview?.status === 'completed'
        ? { eyebrow: 'Candidatura', title: 'Colloquio fatto.', text: 'Ti facciamo sapere presto l\'esito. Intanto puoi completare il profilo.', button: 'Completa il profilo', tone: 'ink' }
        : { eyebrow: 'Candidatura', title: 'La tua candidatura è arrivata.', text: interview ? 'Ti confermiamo noi quale delle date che hai proposto va bene per il colloquio. Intanto puoi completare il profilo.' : 'Ti contatteremo per il colloquio. Intanto puoi completare il profilo.', button: 'Completa il profilo', tone: 'ink' }
    notices.push({ text: `${filled} di 6 sezioni del profilo compilate`, tone: 'neutral' })
  } else if (person.status === 'in_path' && plan && (!open || open.kind === 'ready_confirmation')) {
    card = { eyebrow: 'Percorso completato', title: 'Hai completato il percorso.', text: 'Aspetti la conferma finale.', button: 'Rivedi il tuo profilo', tone: 'ink' }
  } else if (person.status === 'in_path' && plan && open) {
    const n = required.findIndex((s) => s.kind === open.kind) + 1
    card = { eyebrow: `Passo ${n} di ${required.length}`, title: stepLabel[open.kind], text: stepHelp[open.kind], button: open.kind === 'documents' ? 'Carica i documenti' : undefined, tone: 'ink' }
    for (const m of missing) notices.push({ text: `Per l'obiettivo ti manca: ${requirementLabel[m.requirement]}`, tone: 'warn' })
  } else if (person.status === 'in_path') {
    card = { eyebrow: 'In percorso', title: 'Il tuo piano è in preparazione.', tone: 'ink' }
  } else if (person.status === 'ready') {
    const urgent = dated[0]
    const caps = deck.capabilities.filter((c) => c.status === 'active' && c.capability !== 'trainer').map((c) => capabilityLabel[c.capability] ?? c.capability)
    if (urgent || missing.length) {
      card = urgent
        ? { eyebrow: 'Da rinnovare', title: (urgent.days ?? 0) < 0 ? `${urgent.name}: scaduto il ${fmtDate(urgent.on)}.` : `${urgent.name}: scade il ${fmtDate(urgent.on)}.`, text: 'Rinnovalo in tempo per restare in regola sui prossimi incarichi.', button: 'Rinnova ora', tone: 'warn' }
        : { eyebrow: 'Non sei in regola', title: `Ti manca: ${missing.map((m) => requirementLabel[m.requirement]).join(', ')}.`, button: 'Carica i documenti', tone: 'warn' }
      for (const d of dated.slice(1)) notices.push({ text: `${d.name}: ${(d.days ?? 0) < 0 ? 'scaduto' : `scade tra ${d.days} giorni`}`, tone: (d.days ?? 0) < 0 ? 'bad' : 'warn' })
    } else {
      card = { eyebrow: 'Ready', title: `Sei Ready${caps.length ? ` come ${caps.join(' e ')}` : ''}.`, text: isSkipper ? '3 di 3 requisiti validi. Nessuna scadenza nei prossimi 60 giorni.' : undefined, tone: 'ink' }
    }
  } else if (person.status === 'not_accepted') {
    card = { eyebrow: 'Candidatura', title: 'La tua candidatura non è stata accettata.', text: 'Il tuo profilo resta consultabile.', tone: 'ink' }
  } else {
    card = { eyebrow: 'SkillDeck', title: 'Nessuna azione da fare.', tone: 'ink' }
  }

  return (
    <div className="space-y-3">
      <p className="px-1 pt-1 text-sm text-ink-soft">Ciao {person.first_name}</p>
      <section className={`rounded-2xl p-5 ${card.tone === 'warn' ? 'border border-warn/30 bg-warn-soft text-ink' : 'bg-ink text-white'}`}>
        <p className={`text-xs font-semibold tracking-wide uppercase ${card.tone === 'warn' ? 'text-warn' : 'text-white/70'}`}>{card.eyebrow}</p>
        <h1 className="mt-1.5 text-2xl leading-tight font-semibold">{card.title}</h1>
        {card.text && <p className={`mt-2 text-sm ${card.tone === 'warn' ? 'text-ink-soft' : 'text-white/80'}`}>{card.text}</p>}
        {card.button && (
          <Button onClick={onOpenDeck} className={`mt-5 ${card.tone === 'warn' ? '' : '!bg-white !text-ink'}`}>{card.button}</Button>
        )}
      </section>

      {person.status === 'registered' && interview?.status === 'scheduled' && interview.candidate_message && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink-soft">Messaggio per te</h2>
          <p className="mt-1 text-sm whitespace-pre-wrap">{interview.candidate_message}</p>
        </section>
      )}
      {person.status === 'registered' && interview?.status === 'pending' && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink-soft">Le date che hai proposto per il colloquio</h2>
          <ul className="mt-1 space-y-1 text-sm">
            {interview.preferred_slots.map((s) => <li key={s} className="first-letter:uppercase">{fmtSlot(s)}</li>)}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">Preferenza di contatto: {CONTACT[interview.contact_preference as keyof typeof CONTACT] ?? interview.contact_preference}. Orari italiani.</p>
        </section>
      )}

      {person.status === 'in_path' && plan && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink-soft">Il tuo percorso verso {capabilityLabel[plan.goal_capability] ?? plan.goal_capability}</h2>
          <ol className="mt-3 flex items-start">
            {required.map((s, i) => (
              <li key={s.kind} className="flex flex-1 flex-col items-center text-center">
                <span className="flex w-full items-center">
                  <span className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : required[i - 1].status === 'done' ? 'bg-ok' : 'bg-line'}`} />
                  <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${s.status === 'done' ? 'bg-ok text-white' : s.kind === open?.kind ? 'bg-sea text-white' : 'bg-sand text-ink-soft'}`}>{s.status === 'done' ? '✓' : i + 1}</span>
                  <span className={`h-0.5 flex-1 ${i === required.length - 1 ? 'bg-transparent' : s.status === 'done' ? 'bg-ok' : 'bg-line'}`} />
                </span>
                <span className={`mt-1.5 px-0.5 text-[11px] leading-tight ${s.kind === open?.kind ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{stepLabel[s.kind]}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {notices.slice(0, 3).map((n) => (
        <div key={n.text} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
          <span className="text-sm">{n.text}</span>
          {n.tone !== 'neutral' && <Chip tone={n.tone}>{n.tone === 'bad' ? 'Scaduto' : 'Attenzione'}</Chip>}
        </div>
      ))}
    </div>
  )
}
