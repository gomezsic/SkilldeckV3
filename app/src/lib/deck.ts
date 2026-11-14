import { supabase } from './supabase'
import type { Deck, Person, Plan, Title } from './types'

/** Legge tutto ciò che serve a My Deck. Le regole di accesso stanno nel database: qui si legge solo ciò che è mio. */
export async function loadDeck(personId?: string): Promise<Deck | null> {
  // Senza personId leggo la MIA scheda (l'amministratore vede tutte le righe: il filtro è obbligatorio).
  let q = supabase.from('person').select('id, first_name, last_name, email, phone, birth_date, ui_language, family, status, applied_as')
  if (personId) q = q.eq('id', personId)
  else {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return null
    q = q.eq('auth_user_id', auth.user.id)
  }
  const { data: person, error } = await q.maybeSingle()
  if (error) throw error
  if (!person) return null
  const pid = (person as Person).id

  const [caps, plans, titles, compliance, identity, insurance, skills, logbook, tax, prefs] = await Promise.all([
    supabase.from('person_capability').select('capability, status').eq('person_id', pid),
    supabase.from('path_plan').select('id, goal_capability, status, path_step(id, kind, position, status, done_at)').eq('person_id', pid).order('created_at'),
    supabase.from('person_title').select('id, status, expires_on, file_id, rejection_reason, title_catalog(code, name_it), file(storage_path)').eq('person_id', pid).neq('status', 'replaced'),
    supabase.rpc('compliance', { p_person: pid }),
    supabase.from('identity_document').select('id, kind, expires_on, file(storage_path)').eq('person_id', pid),
    supabase.from('insurance').select('id, kind, company, expires_on, file(storage_path)').eq('person_id', pid),
    supabase.from('person_skill').select('kind, value, level').eq('person_id', pid),
    supabase.from('logbook_entry').select('id, from_date, to_date, route, miles, days, nights, source').eq('person_id', pid).order('from_date', { ascending: false }),
    supabase.from('tax_profile').select('tax_code, tax_regime, vat_number, iban, account_holder').eq('person_id', pid).maybeSingle(),
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
      status: t.status, expires_on: t.expires_on, has_file: !!t.file_id, rejection_reason: t.rejection_reason, file_path: t.file?.storage_path ?? null,
    })),
    compliance: compliance.data ?? [],
    identity: (identity.data ?? []).map((d: any) => ({ id: d.id, kind: d.kind, expires_on: d.expires_on, file_path: d.file?.storage_path ?? null })),
    insurance: (insurance.data ?? []).map((d: any) => ({ id: d.id, kind: d.kind, company: d.company, expires_on: d.expires_on, file_path: d.file?.storage_path ?? null })),
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

const BUCKET = 'documenti'
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export async function listCatalog(): Promise<{ id: string; name_it: string }[]> {
  const { data, error } = await supabase.from('title_catalog').select('id, name_it, category, command_level').eq('is_active', true).order('category').order('command_level')
  if (error) throw error
  return data ?? []
}

/** Carica un file nella cartella della persona e lo registra. Restituisce l'id del file. */
export async function uploadFile(personId: string, folder: string, file: File, linkedTable: string): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('Formato non ammesso: usa PDF, JPG, PNG o WEBP.')
  if (file.size > MAX_FILE_BYTES) throw new Error('Il file supera i 10 MB.')
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${personId}/${folder}/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (up.error) throw up.error
  const f = await supabase.from('file').insert({ owner_person_id: personId, uploaded_by: await actorId(), storage_path: path, mime_type: file.type, size_bytes: file.size, linked_table: linkedTable }).select('id').single()
  if (f.error) throw f.error
  return f.data.id
}

export async function declareTitle(personId: string, input: { titleId: string; expiresOn: string | null; number: string | null; file: File }) {
  const fileId = await uploadFile(personId, 'titoli', input.file, 'person_title')
  const t = await supabase.from('person_title').insert({ person_id: personId, title_id: input.titleId, status: 'declared', expires_on: input.expiresOn, number: input.number, file_id: fileId })
  if (t.error) throw t.error
}

/** Inserisce una riga in una delle tabelle "mie" (documenti, assicurazioni, competenze, logbook). */
export async function addRow(table: 'identity_document' | 'insurance' | 'person_skill' | 'logbook_entry', row: Record<string, unknown>) {
  const { error } = await supabase.from(table).insert(row)
  if (error) throw error
}
/** Scrive la riga unica di dati fiscali o preferenze (la crea se manca). */
export async function saveOne(table: 'tax_profile' | 'person_preferences', personId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from(table).upsert({ person_id: personId, ...patch }, { onConflict: 'person_id' })
  if (error) throw error
}
export async function removeSkill(personId: string, kind: string, value: string) {
  const { error } = await supabase.from('person_skill').delete().eq('person_id', personId).eq('kind', kind).eq('value', value)
  if (error) throw error
}

/** Indirizzo temporaneo (un minuto) per aprire un file privato. */
export async function openFile(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener')
}

let actor: string | null = null
/** La scheda di chi sta operando (diversa dal proprietario quando l'amministratore carica per un altro). */
async function actorId(): Promise<string> {
  if (actor) return actor
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('person').select('id').eq('auth_user_id', auth.user?.id ?? '').single()
  if (error) throw error
  actor = data.id
  return data.id
}
