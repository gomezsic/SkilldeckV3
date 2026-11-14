import { useEffect, useState } from 'react'

/** Il nome del file principale dell'app: cambia a ogni pubblicazione. */
const mine = () => [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map((s) => new URL(s.src).pathname).find((p) => p.startsWith('/assets/')) ?? null

/**
 * Chi tiene la pagina aperta resterebbe sulla versione vecchia: quando torna sulla scheda (e ogni dieci minuti)
 * controlliamo se ne è uscita una nuova e proponiamo di aggiornare, senza far perdere ciò che sta scrivendo.
 */
export default function UpdateNotice() {
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    const current = mine()
    if (!current || import.meta.env.DEV) return
    let last = 0
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 60_000) return
      last = Date.now()
      try {
        const html = await (await fetch(`/index.html?t=${Date.now()}`, { cache: 'no-store' })).text()
        const latest = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1]
        if (latest && latest !== current) setFresh(true)
      } catch { /* senza rete riproviamo dopo */ }
    }
    const timer = setInterval(() => void check(), 600_000)
    document.addEventListener('visibilitychange', check); addEventListener('focus', check)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); removeEventListener('focus', check) }
  }, [])
  if (!fresh) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-sea px-4 py-2.5 text-sm font-medium text-white shadow">
      <span>È uscita una versione nuova di SkillDeck.</span>
      <button type="button" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-ink" onClick={() => location.reload()}>Aggiorna ora</button>
      <button type="button" className="underline" onClick={() => setFresh(false)}>Più tardi</button>
    </div>
  )
}
