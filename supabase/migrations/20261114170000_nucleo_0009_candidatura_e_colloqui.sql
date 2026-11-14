-- SkillDeck V3 — nucleo: candidatura uguale a quella di oggi e colloquio conoscitivo.
-- Deciso dall'owner il 14/11/2026 dopo il confronto con skilldeckpro.com:
--  * stessi dati e stesse liste del modulo attuale (certificazioni, lingue, competenze crew);
--  * tendina "Titolo di comando" allineata alle spunte (con senza limiti vela e motore e Master 3000GT);
--  * "Crew Assistant" e "Staff di bordo" sono lo stesso percorso;
--  * la nuova candidatura la vede solo l'amministratore, in cabina di regia;
--  * fasce dei colloqui modificabili dall'amministratore; valori iniziali: lun, mer, gio 17:00-20:00, ogni 15 minuti.

-- ───────────────────────── Catalogo completo dei titoli ─────────────────────────
alter table public.title_catalog
  add column issuer      text,
  add column for_skipper boolean not null default false,
  add column for_crew    boolean not null default false,
  add column sort        smallint not null default 100;

update public.title_catalog set code = 'PATENTE_12M_VELA', name_it = 'Patente nautica entro 12 miglia vela',
       name_en = 'Boat licence within 12 miles, sail' where code = 'PATENTE_12M';
update public.title_catalog set name_it = 'Patente nautica senza limiti vela e motore' where code = 'PATENTE_SL';
update public.title_catalog set name_it = 'Ufficiale di 2ª classe per il diporto' where code = 'UFF_2CL';
update public.title_catalog set name_it = 'SRC (Short Range Certificate)' where code = 'SRC';
update public.title_catalog set name_it = 'YachtMaster Offshore' where code = 'YM_OFFSHORE';
update public.title_catalog set name_it = 'YachtMaster Ocean' where code = 'YM_OCEAN';
update public.title_catalog set name_it = 'Master 200GT' where code = 'MCA_200';
update public.title_catalog set name_it = 'Master 500GT' where code = 'MCA_500';
update public.title_catalog set name_it = 'Master 3000GT' where code = 'MCA_3000';

insert into public.title_catalog (code, name_it, name_en, category, command_level) values
  ('PATENTE_12M_MOTORE', 'Patente nautica entro 12 miglia motore', 'Boat licence within 12 miles, motor', 'command', 1),
  ('PATENTE_SL_MOTORE',  'Patente nautica senza limiti motore',    'Boat licence without limits, motor', 'command', 1),
  ('YM_COASTAL',         'YachtMaster Coastal',                    'Yachtmaster Coastal',                'command', 1),
  ('BLSD_FIRST_AID',     'BLSD+First Aid (Basic Life Support & Defibrillation)', 'BLSD + First Aid',     'first_aid', null),
  ('ELEM_FIRST_AID',     'Elementary First Aid',                   'Elementary First Aid',               'first_aid', null),
  ('FIRST_AID_MERC',     'First Aid Navi Mercantili',              'First Aid for merchant ships',       'first_aid', null),
  ('LRC',                'LRC (Long Range Certificate)',           'Long Range Certificate (LRC)',       'radio', null),
  ('GOC',                'GOC (General Operator Certificate)',     'General Operator Certificate (GOC)', 'radio', null),
  ('ROC',                'ROC (Restricted Operator Certificate)',  'Restricted Operator Certificate (ROC)', 'radio', null),
  ('RTF',                'RTF (Certificato limitato di operatore radiotelefonista per navi)', 'RTF radio operator certificate', 'radio', null),
  ('ENG1',               'ENG1',                                   'ENG1',                               'other', null),
  ('STCW95',             'STCW95 Basic Safety Training',           'STCW95 Basic Safety Training',       'other', null),
  ('METEO_RYA',          'Meteo Master Class (RYA)',               'Meteo Master Class (RYA)',           'other', null),
  ('RYA_DIESEL',         'RYA Diesel Engine Course',               'RYA Diesel Engine Course',           'other', null),
  ('RYA_DIESEL_2',       'RYA Diesel Engine Level 2',              'RYA Diesel Engine Level 2',          'other', null),
  ('YM_SHOREBASED',      'YachtMaster Shorebased',                 'Yachtmaster Shorebased',             'other', null),
  ('HELM',               'HELM – Human Element, Leadership & Management', 'HELM',                        'other', null),
  ('PPR',                'PPR (Professional Practices and Responsibilities)', 'PPR',                     'other', null),
  ('METEO_WT',           'Meteo Masterclass',                      'Meteo Masterclass',                  'other', null),
  ('CHEF',               'Chef',                                   'Chef',                               'other', null),
  ('CREW_ASSISTANT',     'Crew Assistant',                         'Crew Assistant',                     'other', null),
  ('FOOD_SAFETY_2',      'Food Safety Level 2',                    'Food Safety Level 2',                'other', null),
  ('GENTE_DI_MARE',      'Gente di Mare - Iscrizione Albo Marittimi', 'Seafarers register (Italy)',      'other', null),
  ('HACCP',              'HACCP',                                  'HACCP',                              'other', null),
  ('SHIPS_COOK',         'Ship''s Cook Certificate of Competency', 'Ship''s Cook Certificate of Competency', 'other', null),
  ('FPFF',               'FPFF (Fire Prevention and Fire Fighting)', 'FPFF',                             'other', null),
  ('PST',                'PST (Personal Survival Techniques)',     'PST',                                'other', null),
  ('ML5',                'ML5 Medical Certificate',                'ML5 Medical Certificate',            'other', null),
  ('PSSR',               'PSSR (Personal Safety and Social Responsibilities)', 'PSSR',                   'other', null);

-- Ente, ordine e in quale modulo compare ogni titolo (come nel modulo attuale).
update public.title_catalog c set issuer = v.issuer, for_skipper = v.sk, for_crew = v.cr, sort = v.sort
from (values
  ('PATENTE_12M_MOTORE','Ministero delle Infrastrutture e dei Trasporti (Italia)', true,  true,  10),
  ('PATENTE_12M_VELA',  'Ministero delle Infrastrutture e dei Trasporti (Italia)', true,  true,  11),
  ('PATENTE_SL_MOTORE', 'Ministero delle Infrastrutture e dei Trasporti (Italia)', true,  true,  12),
  ('PATENTE_SL',        'Ministero delle Infrastrutture e dei Trasporti (Italia)', true,  true,  13),
  ('UFF_2CL',           'Ministero delle Infrastrutture e dei Trasporti (Italia)', true,  true,  14),
  ('YM_COASTAL',        'RYA', true,  true,  15),
  ('YM_OFFSHORE',       'RYA', true,  true,  16),
  ('YM_OCEAN',          'RYA', true,  false, 17),
  ('MCA_200',           'Autorità Marittima Italiana / MCA', true, false, 18),
  ('MCA_500',           'Autorità Marittima Italiana / MCA', true, false, 19),
  ('MCA_3000',          'Autorità Marittima Italiana / MCA', true, false, 20),
  ('BLSD_FIRST_AID',    'IRC / Croce Rossa Italiana / Enti accreditati 118', true, true, 30),
  ('FIRST_AID',         'RYA / Autorità', true, true, 31),
  ('ELEM_FIRST_AID',    'Varie', false, true, 32),
  ('FIRST_AID_MERC',    'Ministero della Salute', false, true, 33),
  ('ENG1',              'UK Maritime and Coastguard Agency (MCA)', true, true, 40),
  ('STCW95',            'IMO / Autorità marittime nazionali', true, true, 41),
  ('SRC',               'RYA / Ministero Comunicazioni', true, true, 50),
  ('LRC',               'RYA / Ministero Comunicazioni', true, true, 51),
  ('GOC',               'IMO / Autorità nazionali', true, false, 52),
  ('ROC',               'Autorità nazionale', true, true, 53),
  ('RTF',               'Ministero delle Imprese MIMIT (ex Ministero delle Poste)', false, true, 54),
  ('METEO_RYA',         'RYA / Centri privati', false, true, 60),
  ('RYA_DIESEL',        'RYA', false, true, 61),
  ('RYA_DIESEL_2',      'RYA - Royal Yachting Association', false, true, 62),
  ('YM_SHOREBASED',     'RYA', false, true, 63),
  ('HELM',              'MCA – Maritime & Coastguard Agency', false, true, 64),
  ('PPR',               'Autorità Marittima Italiana / MCA', false, true, 65),
  ('METEO_WT',          'Water Tribe', false, true, 66),
  ('CHEF',              'Varie', false, true, 70),
  ('CREW_ASSISTANT',    'Varie', false, true, 71),
  ('FOOD_SAFETY_2',     'Highfield (HABC) / City & Guilds', false, true, 72),
  ('GENTE_DI_MARE',     'Capitaneria di Porto', false, true, 73),
  ('HACCP',             'Varie', false, true, 74),
  ('SHIPS_COOK',        'MCA – Maritime & Coastguard Agency', false, true, 75),
  ('FPFF',              'Varie', false, true, 80),
  ('PST',               'Varie', false, true, 81),
  ('ML5',               'MCA – Maritime & Coastguard Agency', false, true, 82),
  ('PSSR',              'IMO / Autorità nazionali', false, true, 83)
) as v(code, issuer, sk, cr, sort) where c.code = v.code;

-- Nessuna nuova equivalenza: per i requisiti restano validi solo i titoli già decisi (SRC, First Aid, comando).

-- ───────────────────────── Dati della candidatura ─────────────────────────
alter table public.person
  add column gender        text check (gender in ('M','F')),
  add column address       text,
  add column city          text,
  add column mother_tongue text;

create table public.candidacy (
  person_id           uuid primary key references public.person(id),
  track               public.applied_as not null,
  experience_years    text,
  command_title_id    uuid references public.title_catalog(id),
  experience_contexts text[] not null default '{}',
  boat_types          text[] not null default '{}',
  skills              jsonb  not null default '[]',
  cooking_level       text check (cooking_level in ('base','buono','professionale')),
  cooking_type        text,
  about_me            text not null check (length(about_me) between 1 and 2000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.candidacy enable row level security;
create policy candidacy_select on public.candidacy for select to authenticated
  using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin());
create policy candidacy_admin_update on public.candidacy for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, update on public.candidacy to authenticated;
create trigger candidacy_touch before update on public.candidacy
  for each row execute function private.touch_updated_at();
create trigger candidacy_audit_admin after insert or update or delete on public.candidacy
  for each row execute function private.audit_admin_edit();

-- ───────────────────────── Colloqui ─────────────────────────
create table public.interview_settings (
  id           boolean primary key default true check (id),
  weekdays     smallint[] not null default '{1,3,4}',          -- 1 = lunedì … 7 = domenica
  start_time   time not null default '17:00',
  end_time     time not null default '20:00',
  slot_minutes smallint not null default 15 check (slot_minutes in (15, 20, 30, 45, 60)),
  horizon_days smallint not null default 28 check (horizon_days between 7 and 90),
  updated_at   timestamptz not null default now(),
  check (end_time > start_time),
  check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[])
);
insert into public.interview_settings default values;
alter table public.interview_settings enable row level security;
create policy interview_settings_read on public.interview_settings for select to authenticated using (true);
create policy interview_settings_admin on public.interview_settings for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, update on public.interview_settings to authenticated;
create trigger interview_settings_touch before update on public.interview_settings
  for each row execute function private.touch_updated_at();

create table public.interview_request (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references public.person(id),
  contact_preference text not null check (contact_preference in ('phone','whatsapp','google_meet')),
  preferred_slots    timestamptz[] not null check (cardinality(preferred_slots) between 1 and 5),
  status             text not null default 'pending' check (status in ('pending','scheduled','completed','cancelled')),
  scheduled_start    timestamptz,
  duration_minutes   smallint check (duration_minutes in (15, 30, 45, 60, 90)),
  modality           text check (modality in ('phone','whatsapp','google_meet','in_person')),
  location           text,
  candidate_message  text,
  admin_notes        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (status not in ('scheduled','completed') or scheduled_start is not null)
);
create index interview_request_person on public.interview_request(person_id);
alter table public.interview_request enable row level security;
-- Le note dell'amministratore non devono arrivare al candidato: la tabella la legge solo l'amministratore,
-- il candidato vede il proprio colloquio tramite my_interview().
create policy interview_request_admin on public.interview_request for select to authenticated using (private.is_admin());
grant select on public.interview_request to authenticated;
create trigger interview_request_touch before update on public.interview_request
  for each row execute function private.touch_updated_at();

-- Orari già occupati (senza dire da chi): servono al modulo per non proporre fasce prese.
create or replace function public.interview_busy(p_from timestamptz, p_to timestamptz)
returns table (busy_start timestamptz, busy_end timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.scheduled_start, r.scheduled_start + make_interval(mins => r.duration_minutes)
  from public.interview_request r
  where r.status = 'scheduled' and r.scheduled_start < p_to
    and r.scheduled_start + make_interval(mins => r.duration_minutes) > p_from
$$;

-- Il mio colloquio, senza le note riservate.
create or replace function public.my_interview()
returns table (status text, contact_preference text, preferred_slots timestamptz[], scheduled_start timestamptz,
               duration_minutes smallint, modality text, location text, candidate_message text)
language sql stable security definer set search_path = '' as $$
  select r.status, r.contact_preference, r.preferred_slots, r.scheduled_start, r.duration_minutes,
         r.modality, r.location, r.candidate_message
  from public.interview_request r
  where r.person_id = private.my_person_id() and private.is_active_me()
  order by r.created_at desc limit 1
$$;

-- ───────────────────────── Invio della candidatura: tutto o niente ─────────────────────────
create or replace function public.submit_application(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_email text; v_id uuid;
  v_track public.applied_as; v_family public.family;
  v_first text := nullif(btrim(p->>'first_name'), ''); v_last text := nullif(btrim(p->>'last_name'), '');
  v_birth date; v_phone text := nullif(btrim(p->>'phone'), '');
  v_about text := nullif(btrim(p->>'about_me'), '');
  v_mother text := nullif(btrim(p->>'mother_tongue'), '');
  v_slots timestamptz[]; v_contact text := p->>'contact_preference';
  v_cmd uuid; v_lang jsonb; v_code text;
begin
  if v_uid is null then raise exception 'Per inviare la candidatura devi prima entrare' using errcode = '42501'; end if;
  if exists (select 1 from public.person where auth_user_id = v_uid) then raise exception 'Hai già inviato la tua candidatura.'; end if;
  begin v_track := (p->>'track')::public.applied_as; exception when others then raise exception 'Scegli il percorso per cui ti candidi.'; end;
  if v_track not in ('skipper','co_skipper','crew') then raise exception 'Scegli il percorso per cui ti candidi.'; end if;
  if v_first is null or length(v_first) < 2 or v_last is null or length(v_last) < 2 then raise exception 'Nome e cognome sono obbligatori.'; end if;
  begin v_birth := (p->>'birth_date')::date; exception when others then raise exception 'La data di nascita non è scritta bene.'; end;
  if v_birth is null then raise exception 'La data di nascita è obbligatoria.'; end if;
  if coalesce(p->>'gender','') not in ('M','F') then raise exception 'Indica il sesso.'; end if;
  if nullif(btrim(p->>'address'),'') is null or nullif(btrim(p->>'city'),'') is null then raise exception 'Indirizzo e città di residenza sono obbligatori.'; end if;
  if v_phone is null then raise exception 'Il numero di telefono è obbligatorio.'; end if;
  if v_mother is null then raise exception 'Indica la tua lingua madre.'; end if;
  if v_about is null then raise exception 'Scrivi due righe nella parte "Raccontaci di te".'; end if;
  if length(v_about) > 2000 then raise exception 'La presentazione è troppo lunga: il massimo è 2.000 caratteri.'; end if;
  if not coalesce((p->>'privacy')::boolean, false) then raise exception 'Serve il consenso al trattamento dei dati personali.'; end if;
  if coalesce(v_contact,'') not in ('phone','whatsapp','google_meet') then raise exception 'Scegli come vuoi essere contattato per il colloquio.'; end if;
  begin
    select array_agg(distinct s::timestamptz order by s::timestamptz) into v_slots from jsonb_array_elements_text(coalesce(p->'preferred_slots','[]'::jsonb)) s;
  exception when others then raise exception 'Le disponibilità per il colloquio non sono valide: sceglile di nuovo.'; end;
  if v_slots is null or cardinality(v_slots) not between 1 and 5 then raise exception 'Scegli da una a cinque disponibilità per il colloquio.'; end if;
  if v_slots[1] < now() then raise exception 'Una delle disponibilità scelte è già passata: sceglile di nuovo.'; end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null then raise exception 'Email non trovata.'; end if;
  if exists (select 1 from public.person where lower(email) = v_email) then
    raise exception 'Esiste già una scheda con questa email: scrivi a SkillDeck.';
  end if;
  v_family := case when v_track = 'crew' then 'crew_staff' else 'skipper' end;

  insert into public.person(auth_user_id, first_name, last_name, email, phone, birth_date, gender, address, city, mother_tongue,
                            ui_language, family, family_source, family_set_at, status, applied_as)
  values (v_uid, v_first, v_last, v_email, v_phone, v_birth, p->>'gender', btrim(p->>'address'), btrim(p->>'city'), v_mother,
          'it', v_family, 'registration', now(), 'registered', v_track)
  returning id into v_id;
  insert into public.person_status_history(person_id, from_status, to_status, changed_by, reason) values (v_id, null, 'registered', v_id, 'Candidatura');
  insert into public.person_preferences(person_id, privacy_consent_at) values (v_id, now());

  if v_track <> 'crew' and nullif(p->>'command_title','') is not null then
    select id into v_cmd from public.title_catalog where code = p->>'command_title' and category = 'command' and is_active;
  end if;
  insert into public.candidacy(person_id, track, experience_years, command_title_id, experience_contexts, boat_types, skills, cooking_level, cooking_type, about_me)
  values (v_id, v_track, nullif(p->>'experience_years',''), v_cmd,
          case when v_track = 'crew' then coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'experience_contexts','[]'::jsonb)) x), '{}') else '{}' end,
          case when v_track = 'crew' then coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'boat_types','[]'::jsonb)) x), '{}') else '{}' end,
          case when v_track = 'crew' then coalesce(p->'skills','[]'::jsonb) else '[]'::jsonb end,
          case when v_track = 'crew' then nullif(p->>'cooking_level','') end,
          case when v_track = 'crew' then nullif(btrim(p->>'cooking_type'),'') end,
          v_about);

  -- Certificazioni dichiarate: nascono come bozza senza file; il file si carica dopo, dal profilo.
  for v_code in select distinct x from jsonb_array_elements_text(coalesce(p->'certifications','[]'::jsonb)) x loop
    insert into public.person_title(person_id, title_id, status)
    select v_id, c.id, 'draft' from public.title_catalog c where c.code = v_code and c.is_active;
  end loop;

  -- Lingue: la madrelingua e le altre con il loro livello.
  insert into public.person_skill(person_id, kind, value, level) values (v_id, 'language', v_mother, 'Madrelingua');
  for v_lang in select * from jsonb_array_elements(coalesce(p->'languages','[]'::jsonb)) limit 12 loop
    if nullif(btrim(v_lang->>'name'),'') is not null and lower(btrim(v_lang->>'name')) <> lower(v_mother) then
      insert into public.person_skill(person_id, kind, value, level)
      values (v_id, 'language', btrim(v_lang->>'name'), case when v_lang->>'level' = 'certificato' then 'Certificato' else 'Elementare' end)
      on conflict (person_id, kind, value) do nothing;
    end if;
  end loop;

  insert into public.interview_request(person_id, contact_preference, preferred_slots) values (v_id, v_contact, v_slots);
  perform private.log_action(v_id, 'submit_application', 'person', v_id, jsonb_build_object('track', v_track));
  return v_id;
end $$;

-- ───────────────────────── Comandi dell'amministratore sui colloqui ─────────────────────────
create or replace function public.cmd_schedule_interview(p_request uuid, p_start timestamptz, p_duration integer,
  p_modality text, p_location text default null, p_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_status text;
begin
  select status into v_status from public.interview_request where id = p_request for update;
  if not found then raise exception 'Richiesta di colloquio non trovata.'; end if;
  if v_status = 'completed' then raise exception 'Questo colloquio è già stato fatto.'; end if;
  if p_start < now() then raise exception 'La data scelta è già passata.'; end if;
  if exists (select 1 from public.interview_request r
              where r.id <> p_request and r.status = 'scheduled'
                and r.scheduled_start < p_start + make_interval(mins => p_duration)
                and r.scheduled_start + make_interval(mins => r.duration_minutes) > p_start) then
    raise exception 'In quell''orario c''è già un altro colloquio: scegli un altro orario.';
  end if;
  update public.interview_request
     set status = 'scheduled', scheduled_start = p_start, duration_minutes = p_duration, modality = p_modality,
         location = nullif(btrim(p_location),''), candidate_message = nullif(btrim(p_message),'')
   where id = p_request;
  perform private.log_action(me, 'schedule_interview', 'interview_request', p_request, jsonb_build_object('start', p_start));
end $$;

create or replace function public.cmd_complete_interview(p_request uuid, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); n integer;
begin
  update public.interview_request set status = 'completed', admin_notes = coalesce(nullif(btrim(p_notes),''), admin_notes)
   where id = p_request and status = 'scheduled';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Si può chiudere solo un colloquio già fissato.'; end if;
  perform private.log_action(me, 'complete_interview', 'interview_request', p_request, null);
end $$;

create or replace function public.cmd_cancel_interview(p_request uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); n integer;
begin
  update public.interview_request set status = 'pending', scheduled_start = null, duration_minutes = null,
         admin_notes = coalesce(nullif(btrim(p_reason),''), admin_notes)
   where id = p_request and status = 'scheduled';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Si può annullare solo un colloquio già fissato.'; end if;
  perform private.log_action(me, 'cancel_interview', 'interview_request', p_request, null);
end $$;

revoke execute on function public.interview_busy(timestamptz, timestamptz), public.my_interview(), public.submit_application(jsonb),
  public.cmd_schedule_interview(uuid, timestamptz, integer, text, text, text), public.cmd_complete_interview(uuid, text),
  public.cmd_cancel_interview(uuid, text) from public, anon;
grant execute on function public.interview_busy(timestamptz, timestamptz), public.my_interview(), public.submit_application(jsonb),
  public.cmd_schedule_interview(uuid, timestamptz, integer, text, text, text), public.cmd_complete_interview(uuid, text),
  public.cmd_cancel_interview(uuid, text) to authenticated;
