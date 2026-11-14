import { useEffect, useState } from 'react'
import { Chip } from '../components/ui'
import { appliedAsLabel, statusLabel } from '../lib/labels'
import { supabase } from '../lib/supabase'
import type { PersonStatus } from '../lib/types'

interface Row { id: string; first_name: string; last_name: string; email: string; status: PersonStatus; family: string; applied_as: string | null }
const PAGE = 50
const filters: (PersonStatus | 'all')[] = ['all', 'registered', 'in_path', 'ready', 'not_accepted', 'excluded']
const tone = { registered: 'neutral', in_path: 'sea', ready: 'ok', not_accepted: 'neutral', excluded: 'bad' } as const
const familyLabel: Record<string, string> = { skipper: 'Skipper', crew_staff: 'Crew e staff', owner: 'Armatore', admin: 'Amministratore' }

/** Tutte le persone, con ricerca: per aprire la scheda di chiunque, non solo di chi è in coda. */
export default function People({ onOpen }: { onOpen: (personId: string) => void }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<PersonStatus | 'all'>('all')
  const [archived, setArchived] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      let q = supabase.from('person').select('id, first_name, last_name, email, status, family, applied_as', { count: 'exact' })
        .order('last_name').order('first_name').limit(PAGE)
      if (status !== 'all') q = q.eq('status', status)
      q = archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null)
      // Virgole e parentesi hanno un significato nel filtro: le tolgo dal testo cercato.
      const term = text.trim().replace(/[,()%*\\]/g, ' ').trim()
      if (term) q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
      const { data, error, count } = await q
      if (error) setError(error.message); else { setError(null); setRows(data as Row[]); setTotal(count ?? 0) }
    }, 250)
    return () => clearTimeout(t)
  }, [text, status, archived])

  return (
    <section className="mt-6 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-base font-semibold">Persone</h2>
      <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Cerca per nome, cognome o email" aria-label="Cerca una persona"
        className="mt-3 h-12 w-full rounded-xl border border-line bg-card px-3 text-base" />
      <div className="mt-2 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button key={f} type="button" aria-pressed={status === f} onClick={() => setStatus(f)}
            className={`h-9 rounded-full border px-3 text-xs font-semibold ${status === f ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink-soft'}`}>
            {f === 'all' ? 'Tutti' : statusLabel[f]}
          </button>
        ))}
        <button type="button" aria-pressed={archived} onClick={() => setArchived(!archived)}
          className={`h-9 rounded-full border px-3 text-xs font-semibold ${archived ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink-soft'}`}>In archivio</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
      {rows === null ? <p className="mt-3 text-sm text-ink-soft">Carico…</p>
        : rows.length === 0 ? <p className="mt-3 text-sm text-ink-soft">Nessuna persona trovata.</p> : (
          <>
            <ul className="mt-2 divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-sand/60">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.last_name} {r.first_name}</span>
                      <span className="block truncate text-xs text-ink-soft">{familyLabel[r.family] ?? r.family}{r.applied_as ? ` · candidatura ${appliedAsLabel[r.applied_as]}` : ''} · {r.email}</span>
                    </span>
                    <Chip tone={tone[r.status]}>{statusLabel[r.status]}</Chip>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">{total > rows.length ? `Mostro ${rows.length} persone su ${total}: restringi la ricerca per vedere le altre.` : `${total} ${total === 1 ? 'persona' : 'persone'}`}</p>
          </>
        )}
    </section>
  )
}
