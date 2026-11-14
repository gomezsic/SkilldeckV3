import { supabase } from './supabase'

declare const __APP_VERSION__: string
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'prova'

export interface ErrorReport { source: 'schermata' | 'salvataggio' | 'rete' | 'altro'; message: string; shown?: string; code?: string }
const seen = new Set<string>()
let sent = 0

/**
 * Scrive nel registro degli errori ciò che è andato storto, così l'amministratore lo vede in "Sistema" senza che l'utente debba raccontarlo.
 * Non manda mai il contenuto dei moduli: solo il testo tecnico dell'errore, la pagina e la versione. Al massimo 15 segnalazioni per visita.
 */
export function reportError(r: ErrorReport) {
  try {
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('demo')) return
    const key = `${r.source}|${r.code ?? ''}|${r.message.slice(0, 120)}`
    if (seen.has(key) || sent >= 15) return
    seen.add(key); sent++
    void supabase.rpc('log_error', { p: { ...r, message: r.message.slice(0, 1000), page: location.hash || location.pathname, app_version: APP_VERSION, device: navigator.userAgent.slice(0, 200) } }).then(() => undefined, () => undefined)
  } catch { /* la segnalazione non deve mai rompere l'app */ }
}

/** Errori che nessuno ha gestito: una schermata che si rompe, una promessa rimasta senza risposta. */
export function watchUnhandled() {
  addEventListener('error', (e) => reportError({ source: 'schermata', message: `${e.message} (${(e.filename ?? '').split('/').pop()}:${e.lineno})` }))
  addEventListener('unhandledrejection', (e) => reportError({ source: 'schermata', message: String((e.reason as { message?: string })?.message ?? e.reason) }))
}
