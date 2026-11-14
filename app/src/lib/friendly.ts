import { useEffect } from 'react'

/**
 * Regola del prodotto (owner, 14/11/2026): mai errori generici. Ogni messaggio dice che cosa è successo
 * e che cosa fare, con parole da non esperti. Tutti gli errori passano da qui prima di arrivare sullo schermo.
 */
export function friendly(e: unknown, doing = 'salvare'): string {
  const err = (e ?? {}) as { message?: string; code?: string; status?: number; statusCode?: string | number; name?: string }
  const text = String(err.message ?? '')
  const m = text.toLowerCase()
  const status = Number(err.status ?? err.statusCode ?? 0)

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Sembra che manchi la connessione a internet. Controlla la rete e riprova: quello che hai scritto è ancora qui.'
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) return 'Non riusciamo a raggiungere SkillDeck in questo momento. Controlla la connessione e riprova: quello che hai scritto è ancora qui.'
  if (m.includes('jwt') || status === 401 || err.code === 'PGRST301') return 'Sei rimasto fermo a lungo e l\'accesso è scaduto. Esci, entra di nuovo e ripeti l\'operazione.'
  // I nostri controlli nel database parlano già italiano semplice: li mostriamo così come sono.
  if (err.code === 'P0001' && text) return text
  if (err.code === '42501' || m.includes('row-level security') || m.includes('permission denied')) return 'Questa operazione non ti è permessa. Se pensi che sia un errore, scrivi a SkillDeck.'
  if (err.code === '23505') return 'Questo dato c\'è già: non serve inserirlo una seconda volta.'
  if (err.code === '23502') return 'Manca un dato obbligatorio: controlla i campi e riprova.'
  if (err.code === '23514' || err.code === '22003') return 'Un numero o una data non è ammesso: controlla quello che hai scritto.'
  if (err.code === '22007' || err.code === '22008' || err.code === '22P02' || m.includes('invalid input syntax')) return 'Una data o un numero non è scritto nel modo giusto: controlla i campi e riprova.'
  if (status === 413 || m.includes('maximum allowed size') || m.includes('too large')) return 'Il file è troppo pesante: il massimo è 10 MB. Prova a fotografare il documento con il telefono, oppure a ridurre il PDF.'
  if (m.includes('mime type') || status === 415) return 'Questo tipo di file non è accettato. Servono un PDF oppure una foto JPG o PNG.'
  if (m.includes('object not found') || status === 404) return 'Il file non si trova più. Ricaricalo, oppure scrivi a SkillDeck.'
  // Gli errori scritti da noi nell'applicazione sono già in italiano.
  if (e instanceof Error && !err.code && e.name === 'Error' && text) return text
  return `Non siamo riusciti a ${doing}. Riprova tra poco: se succede ancora, scrivi a SkillDeck dicendo che cosa stavi facendo.`
}

const MAX = 10 * 1024 * 1024
const OK_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const known: Record<string, string> = {
  heic: 'una foto in formato HEIC (quello degli iPhone)', heif: 'una foto in formato HEIF', doc: 'un documento Word', docx: 'un documento Word',
  xls: 'un foglio Excel', xlsx: 'un foglio Excel', pages: 'un documento Pages', zip: 'un archivio compresso', rar: 'un archivio compresso',
  txt: 'un file di testo', mov: 'un video', mp4: 'un video', gif: 'un\'immagine GIF', tif: 'un\'immagine TIFF', tiff: 'un\'immagine TIFF',
}
/** Controlla il file nel momento in cui viene scelto. Restituisce il problema, spiegato, oppure null. */
export function fileProblem(file: File): string | null {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!OK_TYPES.includes(file.type)) {
    const what = known[ext] ?? (ext ? `un file .${ext}` : 'un tipo di file che non riconosciamo')
    const tip = ext === 'heic' || ext === 'heif' ? ' Apri la foto e fai uno screenshot, oppure inviala a te stesso per email scegliendo "JPG".' : ' Se hai il documento su carta, basta fotografarlo con il telefono.'
    return `Hai scelto ${what}. Qui servono un PDF oppure una foto JPG o PNG.${tip}`
  }
  if (file.size > MAX) return `Questo file pesa ${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB e il massimo è 10 MB. Prova a fotografare il documento con il telefono, oppure a ridurre il PDF.`
  if (file.size === 0) return 'Questo file è vuoto. Scegline un altro.'
  return null
}
export const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

// ───────── Modifiche non salvate ─────────
const dirty = new Set<symbol>()
/** Segnala che c'è un modulo aperto con dati non salvati: il browser avvisa se si prova a chiudere la pagina. */
export function useUnsaved(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return
    const key = Symbol('modulo')
    dirty.add(key)
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => { dirty.delete(key); window.removeEventListener('beforeunload', warn) }
  }, [isDirty])
}
/** Da chiamare prima di cambiare pagina dentro l'applicazione: true se si può andare. */
export function canLeave(): boolean {
  if (dirty.size === 0) return true
  return window.confirm('Hai scritto dei dati che non hai ancora salvato.\n\nPremi OK per uscire senza salvare, oppure Annulla per restare e premere "Salva".')
}

// ───────── Conferma di salvataggio ─────────
const listeners = new Set<(text: string) => void>()
export function say(text: string) { listeners.forEach((l) => l(text)) }
export function onSay(l: (text: string) => void) { listeners.add(l); return () => { listeners.delete(l) } }
