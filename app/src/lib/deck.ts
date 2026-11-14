import { supabase } from './supabase'
import type { Deck, Person, Plan, Title } from './types'

/** Legge tutto ciò che serve a My Deck. Le regole di accesso stanno nel database: qui si legge solo ciò che è mio. */
export async function loadDeck(): Promise<Deck | null> {
  const { data: person, error } = await supabase
    .from('person')
    .select('id, first_name, last_name, email, phone, birth_date, ui_language, family, status, applied_as')
    .maybeSingle()
  if (error) throw error
  if (!person) return null
  const pid = (person as Person).id

  const [caps, plans, titles, compliance, identity, insurance, skills, logbook, tax, prefs] = await Promise.all([
    supabase.from('person_capability').select('capability, status').eq('person_id', pid),
    supabase.from('path_plan').select('id, goal_capability, status, path_step(kind, position, status, done_at)').eq('person_id', pid).order('created_at'),
    supabase.from('person_title').select('id, status, expires_on, file_id, rejection_reason, title_catalog(code, name_it)').eq('person_id', pid).neq('status', 'replaced'),
    supabase.rpc('compliance'),
    supabase.from('identity_document').select('id, kind, expires_on').eq('person_id', pid),
    supabase.from('insurance').select('id, kind, company, expires_on').eq('person_id', pid),
    supabase.from('person_skill').select('kind, value, level').eq('person_id', pid),
    supabase.from('logbook_entry').select('id, from_date, to_date, route, miles, days, nights, source').eq('person_id', pid).order('from_date', { ascending: false }),
    supabase.from('tax_profile').select('tax_code, tax_regime, vat_number, iban').eq('person_id', pid).maybeSingle(),
    supabase.from('person_preferences').select('privacy_consent_at, marketing_opt_out, showcase_consent').eq('person_id', pid).maybeSingle(),
  ])
  for (const r of [caps, plans, titles, compliance, identity, insurance, skills, logbook, tax, prefs]) {
    if (r.error) throw r.error
  }

  return {
    person: person as Person,
    capabilities: caps.data ?? [],
    plans: (plans.data ?? []).map((p: any): Plan => ({
      id: p.id, goal_capability: p.goal_capability, status: p.status,
      steps: [...(p.path_step ?? [])].sort((a, b) => a.position - b.position),
    })),
    titles: (titles.data ?? []).map((t: any): Title => ({
      id: t.id, code: t.title_catalog?.code ?? '', name_it: t.title_catalog?.name_it ?? 'Titolo',
      status: t.status, expires_on: t.expires_on, has_file: !!t.file_id, rejection_reason: t.rejection_reason,
    })),
    compliance: compliance.data ?? [],
    identity: identity.data ?? [],
    insurance: insurance.data ?? [],
    skills: skills.data ?? [],
    logbook: logbook.data ?? [],
    tax: tax.data ?? null,
    preferences: prefs.data ?? null,
  }
}

export async function savePersonalData(id: string, patch: Pick<Person, 'first_name' | 'last_name' | 'phone' | 'birth_date' | 'ui_language'>) {
  const { error } = await supabase.from('person').update(patch).eq('id', id)
  if (error) throw error
}
