import { supabase } from './supabase'

/** Gli elenchi delle scelte (tendine e bottoni) stanno nel database e li cura l'amministratore da Impostazioni. */
export interface Option { id: string; list: string; label: string; group_label: string | null; sort: number; is_active: boolean }
export const LIST_NAMES: Record<string, { name: string; where: string; grouped?: boolean }> = {
  issuer: { name: 'Enti che rilasciano i titoli', where: 'Scheda di una certificazione' },
  title_group: { name: 'Gruppi di certificazioni', where: 'Catalogo delle certificazioni' },
  language: { name: 'Lingue', where: 'Candidatura e curriculum' },
  language_level: { name: 'Livelli di lingua', where: 'Curriculum' },
  zone: { name: 'Zone di navigazione', where: 'Curriculum', grouped: true },
  technical_skill: { name: 'Competenze tecniche', where: 'Curriculum' },
  soft_skill: { name: 'Soft skills', where: 'Curriculum' },
  boat_category: { name: 'Tipologie di imbarcazioni', where: 'Curriculum', grouped: true },
  hobby: { name: 'Hobby e passioni', where: 'Curriculum' },
  sport: { name: 'Sport', where: 'Curriculum' },
  engagement_type: { name: 'Tipologie di ingaggio', where: 'Curriculum, "Cosa cerco"' },
  sought_role: { name: 'Ruoli cercati', where: 'Curriculum, "Cosa cerco"' },
  availability: { name: 'Disponibilità', where: 'Curriculum, "Cosa cerco"' },
  tax_position: { name: 'Posizione contributiva', where: 'Curriculum, "Cosa cerco"' },
  logbook_role: { name: 'Ruoli a bordo', where: 'Logbook' },
  insurance_kind: { name: 'Tipi di assicurazione', where: 'Documenti e assicurazioni' },
  experience_years: { name: 'Fasce di esperienza', where: 'Candidatura' },
  experience_context: { name: 'Contesti di esperienza', where: 'Candidatura Crew' },
  crew_boat: { name: 'Tipi di barca', where: 'Candidatura Crew' },
  crew_skill: { name: 'Competenze dello staff', where: 'Candidatura Crew', grouped: true },
}

let cache: Promise<Option[]> | null = null
export function loadLists(fresh = false): Promise<Option[]> {
  if (!cache || fresh) {
    cache = Promise.resolve(supabase.from('option_list').select('id, list, label, group_label, sort, is_active').order('sort').order('label'))
      .then(({ data, error }) => { if (error) { cache = null; throw error } return (data ?? []) as Option[] })
  }
  return cache
}
/** Le voci attive di un elenco, nell'ordine deciso dall'amministratore. */
export const pick = (all: Option[], list: string) => all.filter((o) => o.list === list && o.is_active)
export function grouped(options: Option[]): { group: string | null; items: Option[] }[] {
  const out: { group: string | null; items: Option[] }[] = []
  for (const o of options) { const g = out.find((x) => x.group === o.group_label); if (g) g.items.push(o); else out.push({ group: o.group_label, items: [o] }) }
  return out
}

export interface CatalogItem { id: string; code: string; name_it: string; issuer: string | null; group_label: string | null; description: string | null; scope: string | null; validity_months: number | null; commercial: boolean; is_active: boolean; category: string; for_skipper: boolean; for_crew: boolean; sort: number }
export async function loadCatalog(all = false): Promise<CatalogItem[]> {
  let q = supabase.from('title_catalog').select('id, code, name_it, issuer, group_label, description, scope, validity_months, commercial, is_active, category, for_skipper, for_crew, sort').order('sort').order('name_it')
  if (!all) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CatalogItem[]
}
