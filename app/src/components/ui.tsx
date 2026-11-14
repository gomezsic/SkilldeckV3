import { type ReactNode, useEffect, useState } from 'react'
import { fileProblem, fileSize, onSay } from '../lib/friendly'

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'sea'
const toneClass: Record<Tone, string> = {
  neutral: 'bg-sand text-ink-soft', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad', sea: 'bg-sea-soft text-sea',
}
export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${toneClass[tone]}`}>{children}</span>
}

/** Una sezione di My Deck: una scheda che si apre con un tocco. */
export function Section({ title, summary, tone, children, defaultOpen = false }: {
  title: string; summary: string; tone?: Tone; children: ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-2xl border border-line bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">{title}</span>
          <span className={`mt-0.5 block text-sm ${tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink-soft'}`}>{summary}</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className={`shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="border-t border-line px-4 py-4">{children}</div>}
    </section>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium break-words min-w-0">{value || <span className="font-normal text-ink-soft">Da inserire</span>}</span>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-soft">{children}</p>
}

export function Button({ children, variant = 'primary', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const cls = variant === 'primary'
    ? 'bg-ink text-white disabled:opacity-50'
    : 'border border-line bg-card text-ink'
  return <button {...rest} className={`h-12 w-full rounded-xl px-4 text-base font-semibold ${cls} ${rest.className ?? ''}`}>{children}</button>
}

export function Field({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-soft">{label}</span>
      <input {...rest} className="h-12 w-full rounded-xl border border-line bg-card px-3 text-base" />
    </label>
  )
}

/** Scelta di un file con controllo immediato: se il formato o il peso non vanno, lo dice subito e spiega cosa fare. */
export function FileField({ label, required, onFile }: { label: string; required?: boolean; onFile: (file: File | null) => void }) {
  const [chosen, setChosen] = useState<File | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-soft">{label}</span>
      <input required={required} type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          const p = f ? fileProblem(f) : null
          if (p) { e.target.value = ''; setChosen(null); setProblem(p); onFile(null) } else { setChosen(f); setProblem(null); onFile(f) }
        }}
        className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:text-sm file:font-semibold file:text-white" />
      {chosen && <span className="mt-1 block text-xs text-ok">File pronto: {chosen.name} · {fileSize(chosen.size)}</span>}
      {problem && <span role="alert" className="mt-1 block rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{problem}</span>}
    </label>
  )
}

/** La piccola conferma che compare in basso dopo ogni salvataggio riuscito. */
export function Toaster() {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const off = onSay((t) => { setText(t); clearTimeout(timer); timer = setTimeout(() => setText(null), 3500) })
    return () => { off(); clearTimeout(timer) }
  }, [])
  if (!text) return null
  return <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-ok px-5 py-3 text-sm font-semibold text-white shadow-lg lg:bottom-8">✓ {text}</div>
}
