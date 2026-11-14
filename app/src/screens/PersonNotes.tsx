import { useCallback, useEffect, useState } from 'react'
import { Button, Chip } from '../components/ui'
import { friendly, say } from '../lib/friendly'
import { fmtDate } from '../lib/labels'
import { supabase } from '../lib/supabase'
import { ConfirmLink } from './DeckForms'

export type NoteKind = 'note' | 'interview' | 'decision' | 'email' | 'whatsapp' | 'memo'
interface Note { id: string; kind: NoteKind; subject: string | null; body: string; due_on: string | null; done_at: string | null; created_at: string }
const kindLabel: Record<NoteKind, string> = { note: 'Nota', interview: 'Nota del colloquio', decision: 'Decisione', email: 'Email scritta', whatsapp: 'WhatsApp scritto', memo: 'Promemoria' }
const kindTone: Record<NoteKind, 'neutral' | 'sea' | 'ok' | 'warn'> = { note: 'neutral', interview: 'sea', decision: 'ok', email: 'neutral', whatsapp: 'neutral', memo: 'warn' }
const area = 'w-full rounded-xl border border-line bg-card p-3 text-base'
const input = 'h-11 w-full rounded-xl border border-line bg-card px-3 text-base'
const today = () => new Date().toISOString().slice(0, 10)

/** Scrive una riga nel diario della persona. Usata anche dai comandi (decisione, colloquio). */
export async function addNote(personId: string, kind: NoteKind, body: string, extra: { subject?: string | null; due_on?: string | null } = {}) {
  const { error } = await supabase.from('person_note').insert({ person_id: personId, kind, body: body.trim(), subject: extra.subject ?? null, due_on: extra.due_on ?? null })
  if (error) throw error
}

/** Numero per WhatsApp: solo cifre, con il prefisso italiano se manca. */
export function waNumber(phone: string | null): string | null {
  if (!phone) return null
  let d = phone.replace(/\D/g, '')
  if (phone.trim().startsWith('+')) return d.length >= 8 ? d : null
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('3') && d.length >= 9 && d.length <= 10) d = '39' + d
  return d.length >= 8 ? d : null
}

type Mode = null | 'note' | 'memo' | 'email' | 'whatsapp'

/**
 * Diario dell'amministratore sulla persona: note, decisioni, promemoria e messaggi scritti.
 * La persona non lo vede mai. Email e WhatsApp partono dai programmi dell'amministratore: qui resta la copia del testo.
 */
export default function PersonNotes({ personId, firstName, email, phone, version }: { personId: string; firstName: string; email: string; phone: string | null; version?: number }) {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [body, setBody] = useState(''); const [subject, setSubject] = useState(''); const [due, setDue] = useState('')
  const [alsoMemo, setAlsoMemo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null); const [editText, setEditText] = useState('')

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('person_note').select('id, kind, subject, body, due_on, done_at, created_at').eq('person_id', personId).order('created_at', { ascending: false })
    if (error) setError(friendly(error, 'leggere le note')); else setNotes(data as Note[])
  }, [personId])
  useEffect(() => { void reload() }, [reload, version])

  const open = (m: Mode) => {
    setMode(m); setError(null); setSubject(''); setDue(''); setAlsoMemo(false)
    setBody(m === 'email' || m === 'whatsapp' ? `Ciao ${firstName},\n\n` : '')
  }
  const wa = waNumber(phone)

  const save = async () => {
    if (!mode) return
    const text = body.trim()
    if (!text) { setError('Scrivi il testo prima di salvare.'); return }
    if (mode === 'memo' && due && due < today()) { setError('La data del promemoria è già passata: scegline una da oggi in poi.'); return }
    if (mode === 'whatsapp' && !wa) { setError('Su questa scheda manca un numero di telefono valido: aggiungilo nei dati personali.'); return }
    setBusy(true); setError(null)
    try {
      // Il programma di posta o WhatsApp va aperto subito, nello stesso clic, altrimenti il browser lo blocca.
      if (mode === 'email') window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(text)}`
      if (mode === 'whatsapp') window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
      await addNote(personId, mode, text, { subject: mode === 'email' ? subject.trim() || null : null, due_on: mode === 'memo' ? due || null : null })
      if (alsoMemo && (mode === 'email' || mode === 'whatsapp')) await addNote(personId, 'memo', `Controllare la risposta a: ${subject.trim() || text.slice(0, 60)}`, { due_on: due || null })
      say(mode === 'email' ? 'Testo salvato: completa l\'invio nel tuo programma di posta' : mode === 'whatsapp' ? 'Testo salvato: completa l\'invio in WhatsApp' : mode === 'memo' ? 'Promemoria salvato' : 'Nota salvata')
      setMode(null); await reload()
    } catch (e) { setError(friendly(e)) } finally { setBusy(false) }
  }
  const patch = async (id: string, p: Record<string, unknown>, done: string) => {
    const { error } = await supabase.from('person_note').update(p).eq('id', id)
    if (error) { setError(friendly(error)); return }
    say(done); setEditing(null); await reload()
  }

  const memos = (notes ?? []).filter((n) => n.kind === 'memo' && !n.done_at).sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999'))
  const diary = (notes ?? []).filter((n) => !(n.kind === 'memo' && !n.done_at))

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="text-base font-semibold">Note, promemoria e messaggi</h2>
      <p className="text-xs text-ink-soft">Riservato a te: la persona non vede nulla di questo riquadro.</p>
      {error && <p role="alert" className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      {!mode && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="ghost" onClick={() => open('note')}>Scrivi una nota</Button>
          <Button variant="ghost" onClick={() => open('memo')}>Promemoria</Button>
          <Button variant="ghost" onClick={() => open('email')}>Email</Button>
          <Button variant="ghost" onClick={() => open('whatsapp')}>WhatsApp</Button>
        </div>
      )}

      {mode && (
        <form className="mt-3 space-y-3 rounded-xl bg-sand p-3" onSubmit={(e) => { e.preventDefault(); void save() }}>
          <p className="text-sm font-semibold">{mode === 'note' ? 'Nuova nota' : mode === 'memo' ? 'Nuovo promemoria: cosa devi fare o inviare' : mode === 'email' ? `Email a ${email}` : `WhatsApp a ${phone ?? 'numero mancante'}`}</p>
          {mode === 'email' && <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Oggetto</span>
            <input className={input} required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>}
          <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">{mode === 'memo' ? 'Cosa c\'è da fare' : 'Testo'}</span>
            <textarea className={area} rows={mode === 'email' || mode === 'whatsapp' ? 7 : 3} maxLength={8000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={mode === 'memo' ? 'Per esempio: mandargli il link della Career e il programma' : ''} /></label>
          {mode === 'memo' && <label className="block"><span className="mb-1 block text-sm font-medium text-ink-soft">Entro quando (facoltativo)</span>
            <input type="date" className={input} min={today()} value={due} onChange={(e) => setDue(e.target.value)} /></label>}
          {(mode === 'email' || mode === 'whatsapp') && (
            <>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={alsoMemo} onChange={(e) => setAlsoMemo(e.target.checked)} /><span>Aggiungi un promemoria per controllare la risposta</span></label>
              {alsoMemo && <input type="date" aria-label="Entro quando" className={input} min={today()} value={due} onChange={(e) => setDue(e.target.value)} />}
              <p className="text-xs text-ink-soft">{mode === 'email'
                ? 'Si apre il tuo programma di posta con destinatario, oggetto e testo già scritti: lì puoi aggiungere link e allegati e premere Invia. Qui resta la copia del testo.'
                : 'Si apre WhatsApp con il messaggio già scritto: premi tu Invia. Qui resta la copia del testo.'}</p>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>Annulla</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Salvo…' : mode === 'email' ? 'Salva e apri la posta' : mode === 'whatsapp' ? 'Salva e apri WhatsApp' : 'Salva'}</Button>
          </div>
        </form>
      )}

      {memos.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Da fare</h3>
          <ul className="mt-1 divide-y divide-line">
            {memos.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm whitespace-pre-wrap">{m.body}</span>
                  <span className={`block text-xs ${m.due_on && m.due_on < today() ? 'font-semibold text-bad' : 'text-ink-soft'}`}>{m.due_on ? `${m.due_on < today() ? 'In ritardo: era entro il' : 'Entro il'} ${fmtDate(m.due_on)}` : 'Senza data'}</span>
                </span>
                <button type="button" className="h-10 shrink-0 rounded-lg bg-ink px-3 text-sm font-semibold text-white" onClick={() => void patch(m.id, { done_at: new Date().toISOString() }, 'Promemoria fatto')}>Fatto</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes === null ? <p className="mt-3 text-sm text-ink-soft">Carico…</p> : diary.length === 0 && memos.length === 0 ? <p className="mt-3 text-sm text-ink-soft">Ancora nessuna nota su questa persona.</p> : diary.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Diario</h3>
          <ul className="mt-1 divide-y divide-line">
            {diary.map((n) => (
              <li key={n.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={n.kind === 'memo' ? 'ok' : kindTone[n.kind]}>{n.kind === 'memo' ? 'Promemoria fatto' : kindLabel[n.kind]}</Chip>
                  <span className="text-xs text-ink-soft">{fmtDate(n.created_at.slice(0, 10))}</span>
                </div>
                {n.subject && <p className="mt-1 text-sm font-medium">{n.subject}</p>}
                {editing === n.id ? (
                  <form className="mt-1 space-y-2" onSubmit={(e) => { e.preventDefault(); if (editText.trim()) void patch(n.id, { body: editText.trim() }, 'Nota corretta') }}>
                    <textarea className={area} rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                    <div className="flex gap-4 text-xs font-semibold"><button type="submit" className="text-sea">Salva</button><button type="button" className="text-ink-soft" onClick={() => setEditing(null)}>Annulla</button></div>
                  </form>
                ) : <p className="mt-1 text-sm whitespace-pre-wrap">{n.body}</p>}
                {editing !== n.id && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <button type="button" className="text-xs font-semibold text-sea" onClick={() => { setEditing(n.id); setEditText(n.body) }}>Modifica</button>
                    {n.kind === 'memo' && <button type="button" className="text-xs font-semibold text-sea" onClick={() => void patch(n.id, { done_at: null }, 'Promemoria riaperto')}>Riapri</button>}
                    <ConfirmLink label="Elimina" question="La cancello davvero?" yes="Sì, elimina" onConfirm={async () => { const { error } = await supabase.from('person_note').delete().eq('id', n.id); if (error) throw error; await reload() }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
