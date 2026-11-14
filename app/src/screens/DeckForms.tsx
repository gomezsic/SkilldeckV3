import { useState } from 'react'
import { Button } from '../components/ui'

export interface FieldSpec {
  name: string; label: string
  type?: 'text' | 'date' | 'number' | 'select' | 'file' | 'checkbox'
  required?: boolean; options?: { value: string; label: string }[]; placeholder?: string; initial?: string | boolean
}
type Values = Record<string, string | boolean>

/** Un piccolo modulo che si apre da un pulsante: pochi campi, un solo "Salva". */
export function MiniForm({ open: label, submit = 'Salva', fields, onSave, startOpen = false }: {
  open: string; submit?: string; fields: FieldSpec[]; startOpen?: boolean
  onSave: (values: Values, file: File | null) => Promise<void>
}) {
  const initial = () => Object.fromEntries(fields.filter((f) => f.type !== 'file').map((f) => [f.name, f.initial ?? (f.type === 'checkbox' ? false : '')])) as Values
  const [open, setOpen] = useState(startOpen)
  const [values, setValues] = useState<Values>(initial)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)

  if (!open) return <Button variant="ghost" className="mt-3" onClick={() => { setValues(initial()); setOpen(true) }}>{label}</Button>
  const run = async () => {
    setBusy(true); setError(null)
    try { await onSave(values, file); setOpen(false); setFile(null) }
    catch (e) { setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Salvataggio non riuscito') }
    finally { setBusy(false) }
  }
  const input = 'h-12 w-full rounded-xl border border-line bg-card px-3 text-base'
  return (
    <form className="mt-3 space-y-3 rounded-xl bg-sand p-3" onSubmit={(e) => { e.preventDefault(); void run() }}>
      {fields.map((f) => f.type === 'checkbox' ? (
        <label key={f.name} className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5" checked={!!values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} />
          <span>{f.label}</span>
        </label>
      ) : (
        <label key={f.name} className="block">
          <span className="mb-1 block text-sm font-medium text-ink-soft">{f.label}</span>
          {f.type === 'select' ? (
            <select required={f.required} value={String(values[f.name] ?? '')} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className={input}>
              <option value="" disabled>Scegli…</option>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === 'file' ? (
            <input required={f.required} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:text-sm file:font-semibold file:text-white" />
          ) : (
            <input required={f.required} type={f.type ?? 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? 'any' : undefined}
              placeholder={f.placeholder} value={String(values[f.name] ?? '')} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className={input} />
          )}
        </label>
      ))}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Salvo…' : submit}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
    </form>
  )
}

export const str = (v: string | boolean | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : null)
export const num = (v: string | boolean | undefined) => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : null)
