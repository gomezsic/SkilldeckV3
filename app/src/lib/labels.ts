import type { PersonStatus, Requirement, StepKind, StepStatus, TitleStatus } from './types'

export const statusLabel: Record<PersonStatus, string> = {
  registered: 'Wannabe', in_path: 'In percorso', ready: 'Ready', not_accepted: 'Non accettato', excluded: 'Escluso',
}
export const stepLabel: Record<StepKind, string> = {
  interview: 'Colloquio', test: 'Test', career: 'Career', documents: 'Documenti', ready_confirmation: 'Conferma Ready',
}
export const stepStatusLabel: Record<StepStatus, string> = {
  todo: 'Da fare', in_progress: 'In corso', done: 'Fatto', not_required: 'Non richiesto',
}
export const titleStatusLabel: Record<TitleStatus, string> = {
  draft: 'Bozza', declared: 'Dichiarato', verified: 'Verificato', rejected: 'Rifiutato', replaced: 'Sostituito',
}
export const requirementLabel: Record<Requirement, string> = {
  command: 'Titolo di comando', src: 'Radio SRC', first_aid: 'First Aid',
}
export const capabilityLabel: Record<string, string> = {
  skipper_fleet: 'Skipper Flotte', skipper_charter: 'Skipper Charter', fleet_leader: 'Capoflotta',
  co_skipper: 'Co-skipper', hospitality: 'Hospitality', trainer: 'Formatore',
}
export const appliedAsLabel: Record<string, string> = {
  skipper: 'Skipper', co_skipper: 'Co-skipper', crew: 'Crew', staff: 'Staff', trainer: 'Formatore',
}
export const skillKindLabel: Record<string, string> = {
  language: 'Lingue', technical: 'Competenze tecniche', area: 'Zone di navigazione', boat_type: 'Tipi di barca',
}
export const identityKindLabel: Record<string, string> = {
  id_card: "Carta d'identità", passport: 'Passaporto', seaman_book: 'Libretto di navigazione',
}
export const sourceLabel: Record<string, string> = {
  declared: 'Dichiarata da te', imported: 'Importata', generated: 'Da un ingaggio SkillDeck',
}

export function fmtDate(iso: string | null): string {
  if (!iso) return 'Senza scadenza'
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}
export function daysTo(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
}
