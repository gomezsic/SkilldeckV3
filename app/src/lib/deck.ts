import { supabase } from './supabase'
import type { Deck, Person, Plan, Title } from './types'

/** Legge tutto ciò che serve a My Deck. Le regole di accesso stanno nel database: qui si legge solo ciò che è mio. */
export async function loadDeck(personId?: string): Promise<Deck | null> {
  // Senza personId leggo la MIA scheda (l'amministratore vede tutte le righe: il filtro è obbligatorio).
  let q = supabase.from('person').select('id, first_name, last_name, email, phone, birth_date, ui_language, family, status, applied_as, archived_at, gender, address, city, mother_tongue, photo_file_id')
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

  const [caps, plans, titles, compliance, identity, insurance, skills, logbook, tax, prefs, profile, letters, photo] = await Promise.all([
    supabase.from('person_capability').select('capability, status').eq('person_id', pid),
    supabase.from('path_plan').select('id, goal_capability, status, path_step(id, kind, position, status, done_at)').eq('person_id', pid).order('created_at'),
    supabase.from('person_title').select('id, title_id, status, expires_on, issued_on, issuer, number, archived_at, file_id, rejection_reason, title_catalog(code, name_it, group_label), file(storage_path)').eq('person_id', pid).neq('status', 'replaced'),
    supabase.rpc('compliance', { p_person: pid }),
    supabase.from('identity_document').select('id, kind, number, expires_on, issuer, issued_on, archived_at, file(storage_path)').eq('person_id', pid),
    supabase.from('insurance').select('id, kind, company, policy_number, expires_on, issued_on, archived_at, file(storage_path)').eq('person_id', pid),
    supabase.from('person_skill').select('id, kind, value, level').eq('person_id', pid),
    supabase.from('logbook_entry').select('id, from_date, to_date, route, miles, days, nights, source, role_on_board, boat_name, boat_type, boat_model, loa_m, propulsion, night_hours, night_miles, is_tidal, role_label, notes').eq('person_id', pid).order('from_date', { ascending: false }),
    supabase.from('tax_profile').select('tax_code, tax_regime, vat_number, iban, account_holder, birth_place, no_tax_code, company_name, pec, sdi_code, billing_same, billing_address').eq('person_id', pid).maybeSingle(),
    supabase.from('person_preferences').select('privacy_consent_at, marketing_opt_out, showcase_consent').eq('person_id', pid).maybeSingle(),
    supabase.from('person_profile').select('description, objective, smoker, engagement_types, sought_roles, availability, tax_positions, min_daily_rate').eq('person_id', pid).maybeSingle(),
    supabase.from('reference_letter').select('id, title, issuer, issued_on, archived_at, file(storage_path)').eq('person_id', pid).order('issued_on', { ascending: false, nullsFirst: false }),
    (person as Person).photo_file_id ? supabase.from('file').select('storage_path').eq('id', (person as Person).photo_file_id!).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  for (const r of [caps, plans, titles, compliance, identity, insurance, skills, logbook, tax, prefs, profile, letters, photo]) {
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
      status: t.status, expires_on: t.expires_on, has_file: !!t.file_id, rejection_reason: t.rejection_reason, file_path: t.file?.storage_path ?? null, number: t.number, archived_at: t.archived_at,
      title_id: t.title_id, issuer: t.issuer, issued_on: t.issued_on, group_label: t.title_catalog?.group_label ?? null,
    })),
    compliance: compliance.data ?? [],
    identity: (identity.data ?? []).map((d: any) => ({ id: d.id, kind: d.kind, number: d.number, expires_on: d.expires_on, archived_at: d.archived_at, file_path: d.file?.storage_path ?? null, issuer: d.issuer, issued_on: d.issued_on })),
    insurance: (insurance.data ?? []).map((d: any) => ({ id: d.id, kind: d.kind, company: d.company, policy_number: d.policy_number, expires_on: d.expires_on, archived_at: d.archived_at, file_path: d.file?.storage_path ?? null, issued_on: d.issued_on })),
    skills: skills.data ?? [],
    logbook: logbook.data ?? [],
    profile: profile.data ?? null,
    letters: (letters.data ?? []).map((l: any) => ({ id: l.id, title: l.title, issuer: l.issuer, issued_on: l.issued_on, archived_at: l.archived_at, file_path: l.file?.storage_path ?? null })),
    photo_path: (photo.data as any)?.storage_path ?? null,
    tax: tax.data ?? null,
    preferences: prefs.data ?? null,
  }
}

export async function savePersonalData(id: string, patch: Pick<Person, 'first_name' | 'last_name' | 'phone' | 'birth_date' | 'ui_language' | 'gender' | 'address' | 'city'>) {
  const { error } = await supabase.from('person').update(patch).eq('id', id)
  if (error) throw error
}

const BUCKET = 'documenti'
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

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

export interface TitleInput { titleId: string; issuer: string | null; number: string | null; issuedOn: string | null; expiresOn: string | null; file: File | null }
/** Dichiara un titolo nuovo (con il file) oppure completa o corregge uno esistente. */
export async function saveTitle(personId: string, input: TitleInput, existing?: { id: string; status: string }) {
  const fileId = input.file ? await uploadFile(personId, 'titoli', input.file, 'person_title') : null
  const row: Record<string, unknown> = { title_id: input.titleId, issuer: input.issuer, number: input.number, issued_on: input.issuedOn, expires_on: input.expiresOn }
  if (fileId) row.file_id = fileId
  if (!existing) {
    const t = await supabase.from('person_title').insert({ person_id: personId, status: 'declared', ...row })
    if (t.error) throw t.error
    return
  }
  // Una bozza (o un titolo rifiutato) con il file diventa "dichiarato" e torna in verifica.
  if (fileId && (existing.status === 'draft' || existing.status === 'rejected')) { row.status = 'declared'; row.rejection_reason = null }
  const t = await supabase.from('person_title').update(row).eq('id', existing.id)
  if (t.error) throw t.error
}

/** Inserisce una riga in una delle tabelle "mie" (documenti, assicurazioni, competenze, logbook). */
export async function addRow(table: 'identity_document' | 'insurance' | 'person_skill' | 'logbook_entry' | 'reference_letter', row: Record<string, unknown> | Record<string, unknown>[]) {
  const { error } = await supabase.from(table).insert(row)
  if (error) throw error
}
/** Scrive la riga unica di dati fiscali o preferenze (la crea se manca). */
export async function saveOne(table: 'tax_profile' | 'person_preferences' | 'person_profile', personId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from(table).upsert({ person_id: personId, ...patch }, { onConflict: 'person_id' })
  if (error) throw error
}
export async function removeSkill(personId: string, kind: string, value: string) {
  const { error } = await supabase.from('person_skill').delete().eq('person_id', personId).eq('kind', kind).eq('value', value)
  if (error) throw error
}

/** Modifica una riga già esistente (le regole di chi può farlo stanno nel database). */
export async function updateRow(table: 'person_title' | 'identity_document' | 'insurance' | 'logbook_entry' | 'reference_letter', id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  if (error) throw error
}
/** Solo amministratore: archivia (o ripristina) una persona, un titolo, un documento o un'assicurazione. Niente si perde. */
export async function archiveRow(table: 'person' | 'person_title' | 'identity_document' | 'insurance', id: string, restore = false) {
  const { error } = await supabase.rpc('cmd_archive_row', { p_table: table, p_id: id, p_restore: restore })
  if (error) throw error
}
/** Solo amministratore: elimina davvero una competenza o una riga di logbook dichiarata. Il contenuto resta nel registro. */
export async function deleteRow(table: 'person_skill' | 'logbook_entry', id: string) {
  const { error } = await supabase.rpc('cmd_delete_row', { p_table: table, p_id: id })
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

/** Sostituisce le voci di un tipo (zone, competenze, hobby…) con quelle scelte: aggiunge le nuove, toglie le altre. */
export async function setSkills(personId: string, kind: string, before: string[], after: string[]) {
  const add = after.filter((v) => !before.includes(v)); const remove = before.filter((v) => !after.includes(v))
  if (add.length) { const { error } = await supabase.from('person_skill').insert(add.map((value) => ({ person_id: personId, kind, value }))); if (error) throw error }
  if (remove.length) { const { error } = await supabase.from('person_skill').delete().eq('person_id', personId).eq('kind', kind).in('value', remove); if (error) throw error }
}

/** Indirizzo temporaneo (un'ora) per mostrare un'immagine privata, per esempio la foto del profilo. */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
/** Carica la foto del profilo (già ritagliata quadrata) e la collega alla persona. La vecchia resta in archivio. */
export async function setPhoto(personId: string, file: File) {
  const fileId = await uploadFile(personId, 'foto', file, 'person')
  const { error } = await supabase.from('person').update({ photo_file_id: fileId }).eq('id', personId)
  if (error) throw error
}
