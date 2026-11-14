import Papa from 'papaparse'
import type { LogEntry } from './types'

/** Le colonne del file stagionale, nell'ordine del modello. */
export const TEMPLATE_HEADER = ['Data inizio', 'Zona di navigazione', 'Modello barca', 'Nome barca', 'LOA (m)', 'Vela / Motore', 'Ruolo', 'Miglia (NM)', 'Giorni in mare', 'Notti in mare', 'Ore notturne', 'Miglia notturne (NM)', 'Tidal', 'Note']
export const TEMPLATE_EXAMPLE = ['2026-08-30', 'Dalmazia', '46 Cruiser', 'Bavaria 46 Cruiser', '14.27', 'sail', 'Captain (Skipper)', '120', '4', '1', '6', '25', 'false', '']

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
const COLUMNS: Record<string, string> = {
  datainizio: 'from', dal: 'from', data: 'from', datafine: 'to', al: 'to',
  zonadinavigazione: 'route', zona: 'route', luogo: 'route', rotta: 'route',
  modellobarca: 'boat_model', modello: 'boat_model', nomebarca: 'boat_name', barca: 'boat_name',
  loam: 'loa', loa: 'loa', velamotore: 'propulsion', propulsione: 'propulsion', ruolo: 'role',
  miglianm: 'miles', miglia: 'miles', giorniinmare: 'days', giorni: 'days', nottiinmare: 'nights', notti: 'nights',
  orenotturne: 'night_hours', miglianotturnenm: 'night_miles', miglianotturne: 'night_miles', tidal: 'tidal', note: 'notes',
}
const REQUIRED: [string, string][] = [['from', 'Data inizio'], ['route', 'Zona di navigazione'], ['role', 'Ruolo'], ['miles', 'Miglia (NM)'], ['days', 'Giorni in mare']]

const iso = (d: Date) => d.toISOString().slice(0, 10)
export const todayIso = () => iso(new Date())
function parseDate(v: string): string | null {
  const t = v.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  let y: number, mo: number, d: number
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3] }
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t))) { d = +m[1]; mo = +m[2]; y = +m[3] }
  else return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? iso(dt) : null
}
const addDays = (isoDate: string, n: number) => iso(new Date(Date.parse(isoDate + 'T00:00:00Z') + n * 86_400_000))
export const spanDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
function parseNum(v: string | undefined): number | null | 'bad' {
  const t = (v ?? '').trim(); if (!t) return null
  const n = Number(t.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 'bad'
}
/** Dal ruolo scritto a mano al ruolo riconosciuto dalla piattaforma (quando si capisce). */
export function roleFromLabel(label: string | null): string | null {
  const n = norm(label ?? '')
  if (!n) return null
  if (n.includes('coskipper') || n.includes('deckhand') || n.includes('mate')) return 'co_skipper'
  if (n.includes('skipper') || n.includes('captain') || n.includes('comandante')) return 'skipper'
  if (n.includes('hostess') || n.includes('steward')) return 'hostess'
  if (n.includes('chef') || n.includes('cuoc') || n.includes('cook')) return 'cook'
  return null
}

export interface Period { from_date: string; to_date: string }
/** Due navigazioni si sovrappongono se hanno giorni in comune; il solo giorno di cambio barca è ammesso. */
export function overlaps(a: Period, b: Period): boolean {
  if (a.from_date === b.from_date && a.to_date === b.to_date) return true
  return a.from_date < b.to_date && b.from_date < a.to_date
}

/** Controlli di buon senso su una navigazione: gli stessi che rifà il database. Restituisce l'elenco dei problemi. */
export function checkEntry(e: { from_date: string; to_date: string; miles: number | null; days: number | null; nights: number | null; night_hours?: number | null; night_miles?: number | null; loa_m?: number | null }): string[] {
  const out: string[] = []
  if (e.to_date < e.from_date) { out.push('la data di fine viene prima di quella di inizio'); return out }
  const span = spanDays(e.from_date, e.to_date)
  if (e.to_date > todayIso()) out.push('la navigazione finisce nel futuro: si registra quando è conclusa')
  if (e.from_date < '1950-01-01') out.push('la data di inizio è troppo lontana: controlla l\'anno')
  if (span > 367) out.push('dura più di un anno: controlla le date')
  if (e.days != null && e.days > span) out.push(`i giorni in mare (${e.days}) sono più di quelli fra le due date (${span})`)
  if (e.nights != null && e.nights > span) out.push(`le notti (${e.nights}) sono più dei giorni fra le due date (${span})`)
  if (e.miles != null && e.miles > span * 300) out.push('le miglia sono troppe per questi giorni: controlla il numero')
  if (e.night_miles != null && e.miles != null && e.night_miles > e.miles) out.push('le miglia notturne superano le miglia totali')
  if (e.night_hours != null && e.night_hours > span * 24) out.push('le ore notturne sono più delle ore disponibili')
  if (e.loa_m != null && (e.loa_m < 2 || e.loa_m > 150)) out.push('la lunghezza della barca (LOA) deve stare fra 2 e 150 metri')
  return out
}

export interface ImportRow { line: number; label: string; row: Record<string, unknown> | null; problems: string[]; overlap: string | null }
export interface ImportResult { rows: ImportRow[]; fileProblem: string | null }

/** Legge il file stagionale (Excel o CSV) e prepara le righe: quelle buone, quelle da correggere e quelle sovrapposte. */
export async function readSeasonFile(file: File, existing: LogEntry[]): Promise<ImportResult> {
  const name = file.name.toLowerCase()
  const isXlsx = name.endsWith('.xlsx')
  if (/\.(xls|numbers|ods)$/.test(name)) return { rows: [], fileProblem: 'Questo formato non si legge direttamente. Apri il file e salvalo come Excel (.xlsx) oppure come CSV, poi carica quello.' }
  if (!isXlsx && !name.endsWith('.csv') && file.type !== 'text/csv') return { rows: [], fileProblem: 'Il file deve essere un Excel (.xlsx) oppure un CSV: scarica il modello qui sotto per vedere com\'è fatto.' }
  if (file.size > 5 * 1024 * 1024) return { rows: [], fileProblem: 'Il file è troppo grande per essere un logbook stagionale (massimo 5 MB).' }
  let data: string[][]
  if (isXlsx) {
    try {
      // La libreria per Excel si scarica solo quando serve, così l'app resta leggera.
      const { default: readXlsx } = await import('read-excel-file')
      const sheet = await readXlsx(file)
      data = sheet.map((r) => r.map((c) => (c == null ? '' : c instanceof Date ? iso(c) : String(c)))).filter((r) => r.some((c) => c.trim() !== ''))
    } catch { return { rows: [], fileProblem: 'Non siamo riusciti ad aprire questo file Excel: controlla che non sia protetto da password e che le navigazioni siano nel primo foglio.' } }
  } else {
    const text = await file.text()
    data = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' }).data
  }
  if (data.length < 2) return { rows: [], fileProblem: 'Il file è vuoto oppure contiene solo la riga dei titoli.' }
  const header = data[0].map((h) => COLUMNS[norm(String(h))] ?? null)
  const missing = REQUIRED.filter(([k]) => !header.includes(k)).map(([, label]) => label)
  if (missing.length) return { rows: [], fileProblem: `Nel file ${missing.length === 1 ? 'manca la colonna' : 'mancano le colonne'}: ${missing.join(', ')}. Scarica il modello e usa gli stessi titoli.` }
  if (data.length > 501) return { rows: [], fileProblem: 'Il file ha più di 500 righe: dividilo in più file, uno per stagione.' }

  const accepted: (Period & { label: string })[] = []
  const rows: ImportRow[] = data.slice(1).map((cells, i) => {
    const get = (k: string) => { const idx = header.indexOf(k); return idx < 0 ? '' : String(cells[idx] ?? '').trim() }
    const problems: string[] = []
    const from = parseDate(get('from'))
    if (!get('from')) problems.push('manca la data di inizio'); else if (!from) problems.push(`la data "${get('from')}" non si legge: scrivila come 2026-08-30 oppure 30/08/2026`)
    const nums: Record<string, number | null> = {}
    for (const [k, label] of [['miles', 'miglia'], ['days', 'giorni in mare'], ['nights', 'notti'], ['night_hours', 'ore notturne'], ['night_miles', 'miglia notturne'], ['loa', 'LOA']] as const) {
      const n = parseNum(get(k)); if (n === 'bad') { problems.push(`${label}: "${get(k)}" non è un numero`); nums[k] = null } else nums[k] = n
    }
    if (!get('route')) problems.push('manca la zona di navigazione')
    if (!get('role')) problems.push('manca il ruolo')
    if (nums.miles === null && !problems.some((p) => p.startsWith('miglia:'))) problems.push('mancano le miglia')
    if (nums.days === null && !problems.some((p) => p.startsWith('giorni'))) problems.push('mancano i giorni in mare')
    for (const k of ['days', 'nights'] as const) if (nums[k] !== null && !Number.isInteger(nums[k])) problems.push(`${k === 'days' ? 'i giorni' : 'le notti'} devono essere un numero intero`)
    const p = norm(get('propulsion'))
    const propulsion = !p ? null : ['sail', 'vela', 's'].includes(p) ? 'sail' : ['power', 'motore', 'motor', 'm'].includes(p) ? 'power' : undefined
    if (propulsion === undefined) problems.push(`Vela / Motore: scrivi "sail" oppure "power" (trovato "${get('propulsion')}")`)
    let to: string | null = null
    if (from) {
      if (get('to')) { to = parseDate(get('to')); if (!to) problems.push(`la data di fine "${get('to')}" non si legge`) }
      else to = addDays(from, Math.max(1, Math.ceil(nums.days ?? 1)) - 1)
    }
    const label = `${get('route') || 'Senza zona'} · ${from ? from.split('-').reverse().join('/') : get('from')}`
    if (!from || !to) return { line: i + 2, label, row: null, problems, overlap: null }
    const entry = { from_date: from, to_date: to, miles: nums.miles, days: nums.days, nights: nums.nights, night_hours: nums.night_hours, night_miles: nums.night_miles, loa_m: nums.loa }
    problems.push(...checkEntry(entry))
    let overlap: string | null = null
    if (!problems.length) {
      const hit = existing.find((e) => overlaps(e, entry))
      const inFile = accepted.find((e) => overlaps(e, entry))
      if (hit) overlap = `si sovrappone a una navigazione già nel tuo logbook (${hit.route ?? 'senza nome'}, dal ${hit.from_date})`
      else if (inFile) overlap = `si sovrappone a un'altra riga di questo file (${inFile.label})`
      else accepted.push({ ...entry, label })
    }
    const tidal = ['true', 'si', 'sì', 'yes', '1', 'x', 'vero'].includes(get('tidal').toLowerCase())
    return {
      line: i + 2, label, problems, overlap,
      row: problems.length || overlap ? null : {
        ...entry, route: get('route'), boat_model: get('boat_model') || null, boat_name: get('boat_name') || null, propulsion,
        role_label: get('role'), role_on_board: roleFromLabel(get('role')), is_tidal: tidal, notes: get('notes') || null, source: 'declared',
      },
    }
  })
  return { rows, fileProblem: null }
}

export function downloadTemplate() {
  const csv = Papa.unparse([TEMPLATE_HEADER, TEMPLATE_EXAMPLE])
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = 'logbook_stagionale_modello.csv'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
