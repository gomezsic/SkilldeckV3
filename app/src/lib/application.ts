import { supabase } from './supabase'

/** Liste del modulo di candidatura: le stesse del modulo attuale su skilldeckpro.com (confermate dall'owner il 14/11/2026). */
export type Track = 'skipper' | 'co_skipper' | 'crew'
export const PREFIXES = [
  ['+39', 'Italia'], ['+1', 'USA / Canada'], ['+44', 'Regno Unito'], ['+33', 'Francia'], ['+49', 'Germania'], ['+34', 'Spagna'],
  ['+30', 'Grecia'], ['+385', 'Croazia'], ['+7', 'Russia'], ['+90', 'Turchia'], ['+41', 'Svizzera'], ['+43', 'Austria'],
  ['+31', 'Paesi Bassi'], ['+32', 'Belgio'], ['+351', 'Portogallo'],
] as const
export const LANGUAGES = ['Italiano', 'Inglese', 'Francese', 'Spagnolo', 'Tedesco', 'Greco', 'Croato', 'Portoghese', 'Russo']
export const MAX_LANGUAGES = 12
export const EXPERIENCE = ['Nessuna esperienza', '0-3 anni', '4-5 anni', '6-10 anni', '+10 anni']
export const CONTEXTS = ['Charter', 'Flotta', 'Vacanza organizzata', 'Yacht privato', 'Eventi', 'Crociera', 'Regata']
export const BOATS = ['Monoscafo a vela', 'Catamarano', 'Yacht a motore']
export const SKILL_GROUPS: { title: string; items: string[] }[] = [
  { title: 'Hospitality', items: ['Accoglienza ospiti', 'Servizio a bordo', 'Housekeeping', 'Cabine', 'Mise en place', 'Servizio a tavola', 'Gestione cambusa'] },
  { title: 'Cucina', items: ['Preparazione pasti', 'Allergie e intolleranze', 'Meal planning', 'Approvvigionamento'] },
  { title: 'Crew management', items: ['Lavorare con lo skipper', 'Gestione equipaggio', 'Problem solving', 'Comunicazione', 'Gestione dei conflitti', 'Briefing ospiti'] },
  { title: 'Organizzazione', items: ['Logistica', 'Transfer', 'Check-list', 'Inventario', 'Cambusa', 'Prenotazioni', 'Escursioni', 'Gestione attività'] },
  { title: 'Skill aggiuntive', items: ['Childcare', 'Diving', 'Snorkeling', 'SUP', 'Wingfoil', 'Fotografia', 'Video', 'DJ', 'Fitness', 'First aid', 'Bartending', 'Event management'] },
]
export const SKILL_LEVELS = { help: 'So dare una mano', autonomous: 'Sono autonomo/a' } as const
export const COOKING = { base: 'Base', buono: 'Buono', professionale: 'Professionale' } as const
export const CONTACT = { phone: 'Telefono', whatsapp: 'WhatsApp', google_meet: 'Google Meet' } as const
export const MODALITY = { ...CONTACT, in_person: 'Di persona' } as const
export const DURATIONS = [15, 30, 45, 60, 90]
export const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
export const trackLabel: Record<string, string> = { skipper: 'Skipper', co_skipper: 'Coskipper', crew: 'Crew Assistant / Staff di bordo', staff: 'Crew Assistant / Staff di bordo', trainer: 'Formatore' }

export interface CatalogTitle { code: string; name: string; issuer: string | null; category: string; skipper: boolean; crew: boolean }
export interface SlotSettings { weekdays: number[]; start: string; end: string; slot_minutes: number; horizon_days: number }
export interface Options { titles: CatalogTitle[]; settings: SlotSettings; busy: { start: string; minutes: number }[] }
export const DEFAULT_SETTINGS: SlotSettings = { weekdays: [1, 3, 4], start: '17:00', end: '20:00', slot_minutes: 15, horizon_days: 28 }

export async function loadOptions(): Promise<Options> {
  const { data, error } = await supabase.rpc('application_options')
  if (error) throw error
  return { titles: data.titles ?? [], settings: data.settings ?? DEFAULT_SETTINGS, busy: data.busy ?? [] }
}

// ───────── Fasce dei colloqui: gli orari sono sempre quelli italiani (Europe/Rome), ovunque si trovi chi compila.
const ROME = 'Europe/Rome'
const romeParts = new Intl.DateTimeFormat('en-GB', { timeZone: ROME, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
function partsOf(d: Date) {
  const p: Record<string, number> = {}
  for (const x of romeParts.formatToParts(d)) if (x.type !== 'literal') p[x.type] = Number(x.value)
  return p as { year: number; month: number; day: number; hour: number; minute: number }
}
/** Dato un orario "da orologio" italiano restituisce l'istante esatto. */
export function romeInstant(y: number, m: number, d: number, h: number, min: number): Date {
  const guess = Date.UTC(y, m - 1, d, h, min)
  const p = partsOf(new Date(guess))
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - guess
  return new Date(guess - offset)
}
export const fmtSlotDay = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { timeZone: ROME, weekday: 'long', day: 'numeric', month: 'long' })
export const fmtSlotTime = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { timeZone: ROME, hour: '2-digit', minute: '2-digit' })
export const fmtSlot = (iso: string) => `${fmtSlotDay(iso)}, ore ${fmtSlotTime(iso)}`

export interface DaySlots { day: string; label: string; slots: string[] }
/** Le fasce libere dei prossimi giorni, da domani, raggruppate per giorno. */
export function freeSlots(s: SlotSettings, busy: Options['busy'], now = new Date()): DaySlots[] {
  const [sh, sm] = s.start.split(':').map(Number); const [eh, em] = s.end.split(':').map(Number)
  const taken = busy.map((b) => [new Date(b.start).getTime(), new Date(b.start).getTime() + b.minutes * 60_000])
  const today = partsOf(now)
  const out: DaySlots[] = []
  for (let i = 1; i <= s.horizon_days; i++) {
    const noon = new Date(Date.UTC(today.year, today.month - 1, today.day + i, 12))
    const y = noon.getUTCFullYear(), m = noon.getUTCMonth() + 1, d = noon.getUTCDate()
    const weekday = noon.getUTCDay() === 0 ? 7 : noon.getUTCDay()
    if (!s.weekdays.includes(weekday)) continue
    const slots: string[] = []
    for (let t = sh * 60 + sm; t + s.slot_minutes <= eh * 60 + em; t += s.slot_minutes) {
      const at = romeInstant(y, m, d, Math.floor(t / 60), t % 60).getTime()
      if (!taken.some(([a, b]) => at < b && at + s.slot_minutes * 60_000 > a)) slots.push(new Date(at).toISOString())
    }
    if (slots.length) out.push({ day: `${y}-${m}-${d}`, label: fmtSlotDay(slots[0]), slots })
  }
  return out
}

// ───────── La candidatura
export interface ApplicationData {
  track: Track
  first_name: string; last_name: string; birth_date: string; gender: '' | 'M' | 'F'
  address: string; city: string; prefix: string; phone: string
  mother_tongue: string; languages: { name: string; level: 'elementare' | 'certificato' }[]
  experience_years: string; command_title: string; certifications: string[]
  experience_contexts: string[]; boat_types: string[]
  skills: { name: string; level: 'help' | 'autonomous' }[]; cooking_level: string; cooking_type: string
  about_me: string; contact_preference: '' | keyof typeof CONTACT; preferred_slots: string[]; privacy: boolean
}
export const emptyApplication = (track: Track): ApplicationData => ({
  track, first_name: '', last_name: '', birth_date: '', gender: '', address: '', city: '', prefix: '+39', phone: '',
  mother_tongue: '', languages: [], experience_years: '', command_title: '', certifications: [], experience_contexts: [], boat_types: [],
  skills: [], cooking_level: '', cooking_type: '', about_me: '', contact_preference: '', preferred_slots: [], privacy: false,
})
export const toPayload = (a: ApplicationData) => ({ ...a, phone: `${a.prefix} ${a.phone.trim()}`, prefix: undefined })

/** Controlli prima dell'invio: restituisce l'elenco di ciò che manca, in parole semplici. */
export function problems(a: ApplicationData): string[] {
  const p: string[] = []
  if (a.first_name.trim().length < 2) p.push('Scrivi il tuo nome.')
  if (a.last_name.trim().length < 2) p.push('Scrivi il tuo cognome.')
  if (!a.birth_date) p.push('Indica la data di nascita.')
  else {
    const age = (Date.now() - new Date(a.birth_date).getTime()) / (365.25 * 86_400_000)
    if (age < 0) p.push('La data di nascita è nel futuro: controlla l\'anno.')
    else if (age < 16) p.push('Per candidarti devi avere almeno 16 anni: controlla la data di nascita.')
    else if (age > 100) p.push('Controlla l\'anno della data di nascita.')
  }
  if (!a.gender) p.push('Indica il sesso.')
  if (!a.address.trim()) p.push('Scrivi l\'indirizzo di residenza.')
  if (!a.city.trim()) p.push('Scrivi la città di residenza.')
  const digits = (a.prefix + a.phone).replace(/\D/g, '').length
  if (!a.phone.trim()) p.push('Scrivi il numero di telefono.')
  else if (digits < 8 || digits > 15) p.push('Il numero di telefono non sembra completo: controlla le cifre.')
  if (!a.mother_tongue) p.push('Scegli la tua lingua madre.')
  if (a.languages.some((l) => !l.name.trim())) p.push('C\'è una lingua senza nome: scrivila oppure toglila.')
  if (!a.about_me.trim()) p.push('Scrivi due righe in "Raccontaci di te".')
  if (!a.contact_preference) p.push('Scegli come vuoi essere contattato per il colloquio.')
  if (a.preferred_slots.length < 1) p.push('Scegli almeno una disponibilità per il colloquio.')
  if (!a.privacy) p.push('Serve il consenso al trattamento dei dati.')
  return p
}
/** Stessa regola di oggi: almeno 8 caratteri, una maiuscola, un numero, un simbolo. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'La password deve avere almeno 8 caratteri.'
  if (!/[A-Z]/.test(pw)) return 'Nella password serve almeno una lettera maiuscola.'
  if (!/[0-9]/.test(pw)) return 'Nella password serve almeno un numero.'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Nella password serve almeno un simbolo, per esempio ! ? @ #'
  return null
}

const DRAFT = 'skilldeck.candidatura.bozza'
export const saveDraft = (a: ApplicationData) => { try { localStorage.setItem(DRAFT, JSON.stringify(a)) } catch { /* spazio non disponibile: si continua senza bozza */ } }
export const readDraft = (): ApplicationData | null => { try { const s = localStorage.getItem(DRAFT); return s ? JSON.parse(s) as ApplicationData : null } catch { return null } }
export const clearDraft = () => { try { localStorage.removeItem(DRAFT) } catch { /* niente da fare */ } }

export async function submitApplication(payload: unknown) {
  const { error } = await supabase.rpc('submit_application', { p: payload })
  if (error) throw error
  clearDraft()
}

// ───────── Colloqui
export interface MyInterview { status: string; contact_preference: string; preferred_slots: string[]; scheduled_start: string | null; duration_minutes: number | null; modality: string | null; location: string | null; candidate_message: string | null }
export async function loadMyInterview(): Promise<MyInterview | null> {
  const { data, error } = await supabase.rpc('my_interview')
  if (error) throw error
  return (data as MyInterview[] | null)?.[0] ?? null
}
export interface InterviewRequest extends MyInterview { id: string; person_id: string; admin_notes: string | null; created_at: string }
export interface Candidacy { track: string; experience_years: string | null; command_title: string | null; experience_contexts: string[]; boat_types: string[]; skills: { name: string; level: string }[]; cooking_level: string | null; cooking_type: string | null; about_me: string }
export interface PersonExtra { gender: string | null; address: string | null; city: string | null; mother_tongue: string | null }
export async function loadCandidacy(personId: string): Promise<{ candidacy: Candidacy | null; interview: InterviewRequest | null; extra: PersonExtra | null }> {
  const [c, i, p] = await Promise.all([
    supabase.from('candidacy').select('track, experience_years, experience_contexts, boat_types, skills, cooking_level, cooking_type, about_me, title_catalog(name_it)').eq('person_id', personId).maybeSingle(),
    supabase.from('interview_request').select('*').eq('person_id', personId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('person').select('gender, address, city, mother_tongue').eq('id', personId).maybeSingle(),
  ])
  for (const r of [c, i, p]) if (r.error) throw r.error
  const cd = c.data as any
  return {
    candidacy: cd ? { ...cd, command_title: cd.title_catalog?.name_it ?? null } : null,
    interview: (i.data as InterviewRequest | null) ?? null,
    extra: (p.data as PersonExtra | null) ?? null,
  }
}
