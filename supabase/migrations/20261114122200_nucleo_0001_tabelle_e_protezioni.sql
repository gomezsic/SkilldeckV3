-- SkillDeck V3 — nucleo, prima migrazione (applicata al collaudo il 14/11/2026)
-- Scritta il 14/11/2026 a partire dalla "Scheda del nucleo" del documento unico.
-- Regole: nessuna tabella esposta per default, RLS su tutto, i dati protetti
-- (stato, famiglia, capacità, piano, passi, sospensione, verifica titoli)
-- si scrivono solo tramite funzioni-comando.
-- Provata il 14/11/2026 su un Postgres 16 locale usa e getta: si applica senza errori
-- e supera le prove di accesso con tre utenti di esempio (utente, registrato, admin).
-- I comandi sono nel file 0002_comandi.sql.

-- ───────────────────────── Elenchi chiusi ─────────────────────────
create type family            as enum ('skipper','crew_staff','owner','admin');
create type person_status     as enum ('registered','in_path','ready','not_accepted','excluded');
create type applied_as        as enum ('skipper','co_skipper','crew','staff','trainer');
create type ui_language       as enum ('it','en');
create type professional_role as enum ('skipper','co_skipper','fleet_leader','crew_assistant','hostess','cook','staff');
create type capability        as enum ('skipper_fleet','skipper_charter','fleet_leader','co_skipper','hospitality','trainer');
create type capability_status as enum ('active','pending','revoked');
create type plan_template     as enum ('full','career_and_documents','direct_ready');
create type plan_status       as enum ('active','completed','closed');
create type step_kind         as enum ('interview','test','career','documents','ready_confirmation');
create type step_status       as enum ('todo','in_progress','done','not_required');
create type title_category    as enum ('command','radio','first_aid','other');
create type requirement       as enum ('command','src','first_aid');
create type title_status      as enum ('draft','declared','verified','rejected','replaced');
create type title_event       as enum ('declared','verified','rejected','renewed','expired');
create type identity_kind     as enum ('id_card','passport','seaman_book');
create type skill_kind        as enum ('language','technical','area','boat_type');
create type logbook_source    as enum ('declared','imported','generated');
create type email_category    as enum ('service','operational','promotional');
create type email_status      as enum ('queued','sent','failed','blocked');

-- ───────────────────────── Schema privato ─────────────────────────
-- Tutto ciò che non deve mai essere raggiungibile dall'applicazione.
create schema if not exists private;

-- Ruolo di amministratore: tabella a parte, lato server, mai nel profilo.
create table private.admin_user (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  granted_at   timestamptz not null default now(),
  granted_by   uuid
);

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.admin_user a where a.auth_user_id = auth.uid()) $$;

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at := now(); return new; end $$;

-- ───────────────────────── File ─────────────────────────
create table public.file (
  id              uuid primary key default gen_random_uuid(),
  owner_person_id uuid not null,
  storage_path    text not null unique,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0),
  linked_table    text,
  linked_id       uuid,
  uploaded_by     uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ───────────────────────── 1. Persona ─────────────────────────
create table public.person (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete restrict,
  first_name    text not null,
  last_name     text not null,
  email         text not null unique,
  phone         text,
  birth_date    date,
  photo_file_id uuid references public.file(id),
  ui_language   ui_language not null default 'it',
  family        family not null default 'skipper',
  family_source text,
  family_set_at timestamptz,
  status        person_status not null default 'registered',
  applied_as    applied_as,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.file
  add constraint file_owner_fk    foreign key (owner_person_id) references public.person(id),
  add constraint file_uploader_fk foreign key (uploaded_by)     references public.person(id);

create or replace function private.my_person_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select p.id from public.person p where p.auth_user_id = auth.uid() $$;

-- L'interessato può modificare la propria identità ma non stato e famiglia.
create or replace function private.protect_person_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Dentro un comando (funzione del proprietario) current_user non è il ruolo dell'app.
  if current_user not in ('authenticated','anon') or private.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.family is distinct from old.family
     or new.family_source is distinct from old.family_source
     or new.family_set_at is distinct from old.family_set_at
     or new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Campo protetto: si cambia solo tramite comando';
  end if;
  return new;
end $$;
create trigger person_protect before update on public.person
  for each row execute function private.protect_person_fields();

-- ───────────────────────── 2. Ruolo professionale ─────────────────────────
create table public.person_role (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.person(id),
  role       professional_role not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, role)
);
create unique index person_role_one_primary on public.person_role(person_id) where is_primary;

-- ───────────────────────── 3. Storico degli stati ─────────────────────────
create table public.person_status_history (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.person(id),
  from_status person_status,
  to_status   person_status not null,
  changed_by  uuid references public.person(id),
  changed_at  timestamptz not null default now(),
  reason      text,
  check (to_status not in ('not_accepted','excluded') or coalesce(length(trim(reason)),0) > 0)
);

-- ───────────────────────── 4-5. Piano di percorso e passi ─────────────────────────
create table public.path_plan (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references public.person(id),
  goal_capability capability not null,
  template        plan_template not null,
  status          plan_status not null default 'active',
  assigned_by     uuid not null references public.person(id),
  assigned_at     timestamptz not null default now(),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index path_plan_one_active_per_goal
  on public.path_plan(person_id, goal_capability) where status = 'active';

create table public.path_step (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.path_plan(id),
  kind        step_kind not null,
  position    smallint not null,
  status      step_status not null default 'todo',
  done_at     timestamptz,
  done_by     uuid references public.person(id),
  outcome_ref uuid,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (plan_id, kind),
  unique (plan_id, position)
);

-- ───────────────────────── 6. Capacità professionale ─────────────────────────
create table public.person_capability (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.person(id),
  capability    capability not null,
  status        capability_status not null default 'pending',
  granted_by    uuid references public.person(id),
  granted_at    timestamptz,
  revoked_at    timestamptz,
  revoke_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (person_id, capability)
);

-- ───────────────────────── 7. Sospensione dai nuovi incarichi ─────────────────────────
-- Nello schema privato: nessuno la legge tranne l'amministratore, tramite comando.
create table private.assignment_hold (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.person(id),
  reason     text not null check (length(trim(reason)) > 0),
  started_by uuid not null references public.person(id),
  started_at timestamptz not null default now(),
  ended_by   uuid references public.person(id),
  ended_at   timestamptz
);
create unique index assignment_hold_one_open on private.assignment_hold(person_id) where ended_at is null;

-- ───────────────────────── 8-9. Dati fiscali e preferenze ─────────────────────────
create table public.tax_profile (
  person_id       uuid primary key references public.person(id),
  tax_code        text,
  tax_regime      text,
  vat_number      text,
  iban            text,
  account_holder  text,
  billing_address jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.person_preferences (
  person_id          uuid primary key references public.person(id),
  privacy_consent_at timestamptz,
  marketing_opt_out  boolean not null default false,
  showcase_consent   boolean not null default false,
  sizes              jsonb,
  seen_guides        text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ───────────────────────── 10-11. Catalogo titoli ed equivalenze ─────────────────────────
create table public.title_catalog (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name_it         text not null,
  name_en         text not null,
  category        title_category not null,
  command_level   smallint,
  validity_months smallint,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (category <> 'command' or command_level is not null)
);

create table public.title_equivalence (
  title_id           uuid not null references public.title_catalog(id),
  covers_requirement requirement not null,
  primary key (title_id, covers_requirement)
);

-- ───────────────────────── 12-13. Titoli della persona e storico ─────────────────────────
create table public.person_title (
  id               uuid primary key default gen_random_uuid(),
  person_id        uuid not null references public.person(id),
  title_id         uuid not null references public.title_catalog(id),
  number           text,
  issuer           text,
  issued_on        date,
  expires_on       date,
  file_id          uuid references public.file(id),
  status           title_status not null default 'draft',
  rejection_reason text,
  replaces_id      uuid references public.person_title(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'rejected' or coalesce(length(trim(rejection_reason)),0) > 0)
);

create table public.person_title_history (
  id              uuid primary key default gen_random_uuid(),
  person_title_id uuid not null references public.person_title(id),
  event           title_event not null,
  by_person_id    uuid references public.person(id),
  at              timestamptz not null default now(),
  note            text
);

-- L'interessato dichiara; verificare e rifiutare spetta all'amministratore.
create or replace function private.protect_title_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated','anon') or private.is_admin() then
    return new;
  end if;
  if new.status in ('verified','rejected') and new.status is distinct from old.status then
    raise exception 'Verifica e rifiuto spettano all''amministratore';
  end if;
  if old.status = 'verified' then
    raise exception 'Un titolo verificato non si modifica: si rinnova con un titolo nuovo';
  end if;
  return new;
end $$;
create trigger person_title_protect before update on public.person_title
  for each row execute function private.protect_title_status();

-- ───────────────────────── 14-17. Documenti, assicurazioni, competenze, logbook ─────────────────────────
create table public.identity_document (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.person(id),
  kind       identity_kind not null,
  number     text,
  expires_on date,
  file_id    uuid references public.file(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.insurance (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.person(id),
  kind          text not null,
  company       text,
  policy_number text,
  expires_on    date,
  file_id       uuid references public.file(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.person_skill (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.person(id),
  kind       skill_kind not null,
  value      text not null,
  level      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, kind, value)
);

create table public.logbook_entry (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.person(id),
  from_date     date not null,
  to_date       date not null,
  route         text,
  miles         numeric(8,1) check (miles >= 0),
  days          smallint check (days >= 0),
  nights        smallint check (nights >= 0),
  role_on_board professional_role,
  boat_name     text,
  boat_type     text,
  source        logbook_source not null default 'declared',
  source_ref    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (to_date >= from_date)
);

-- ───────────────────────── 19-20. Registri ─────────────────────────
create table public.action_log (
  id                  uuid primary key default gen_random_uuid(),
  actor_person_id     uuid references public.person(id),
  acting_as_person_id uuid references public.person(id),
  action              text not null,
  target_table        text,
  target_id           uuid,
  details             jsonb,
  at                  timestamptz not null default now()
);

create table public.email_log (
  id               uuid primary key default gen_random_uuid(),
  template_code    text not null,
  template_version integer not null,
  category         email_category not null,
  to_person_id     uuid references public.person(id),
  to_address       text not null,
  triggered_by     text not null,
  campaign_id      uuid,
  status           email_status not null default 'queued',
  blocked_reason   text,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- ───────────────────────── updated_at ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['file','person','person_role','path_plan','path_step','person_capability',
    'tax_profile','person_preferences','title_catalog','person_title','identity_document',
    'insurance','person_skill','logbook_entry']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
  end loop;
end $$;

-- ───────────────────────── Row Level Security ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['file','person','person_role','person_status_history','path_plan','path_step',
    'person_capability','tax_profile','person_preferences','title_catalog','title_equivalence',
    'person_title','person_title_history','identity_document','insurance','person_skill',
    'logbook_entry','action_log','email_log']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
alter table private.admin_user      enable row level security;
alter table private.assignment_hold enable row level security;

-- Chi è Escluso non accede a nulla.
create or replace function private.is_active_me() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.person p
                     where p.auth_user_id = auth.uid() and p.status <> 'excluded') $$;

-- Persona: leggo e modifico la mia riga (i campi protetti li difende il trigger).
create policy person_select_own on public.person for select to authenticated
  using ((auth_user_id = auth.uid() and status <> 'excluded') or private.is_admin());
create policy person_update_own on public.person for update to authenticated
  using ((auth_user_id = auth.uid() and status <> 'excluded') or private.is_admin())
  with check (auth_user_id = auth.uid() or private.is_admin());
create policy person_admin_insert on public.person for insert to authenticated
  with check (private.is_admin());

-- Tabelle "mie": leggo e scrivo le mie righe; l'amministratore tutto. Nessuna cancellazione.
do $$
declare t text;
begin
  foreach t in array array['person_role','tax_profile','person_preferences','identity_document',
    'insurance','person_skill']
  loop
    execute format($f$create policy %1$I_own_select on public.%1$I for select to authenticated
      using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin())$f$, t);
    execute format($f$create policy %1$I_own_insert on public.%1$I for insert to authenticated
      with check ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin())$f$, t);
    execute format($f$create policy %1$I_own_update on public.%1$I for update to authenticated
      using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin())
      with check (person_id = private.my_person_id() or private.is_admin())$f$, t);
  end loop;
end $$;

-- Titoli: come sopra, verifica e rifiuto difesi dal trigger.
create policy person_title_own_select on public.person_title for select to authenticated
  using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin());
create policy person_title_own_insert on public.person_title for insert to authenticated
  with check (((person_id = private.my_person_id() and private.is_active_me()) and status in ('draft','declared'))
              or private.is_admin());
create policy person_title_own_update on public.person_title for update to authenticated
  using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin())
  with check (person_id = private.my_person_id() or private.is_admin());
create policy person_title_history_select on public.person_title_history for select to authenticated
  using (private.is_admin() or exists (select 1 from public.person_title pt
         where pt.id = person_title_id and pt.person_id = private.my_person_id()));

-- Logbook: dal momento in cui si è In percorso; le righe generate non si toccano.
create policy logbook_own_select on public.logbook_entry for select to authenticated
  using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin());
create policy logbook_own_insert on public.logbook_entry for insert to authenticated
  with check (private.is_admin() or (person_id = private.my_person_id() and source = 'declared'
    and exists (select 1 from public.person p where p.id = person_id and p.status in ('in_path','ready'))));
create policy logbook_own_update on public.logbook_entry for update to authenticated
  using (private.is_admin() or (person_id = private.my_person_id() and source = 'declared' and private.is_active_me()))
  with check (private.is_admin() or (person_id = private.my_person_id() and source = 'declared'));

-- File: leggo i miei; carico a mio nome.
create policy file_own_select on public.file for select to authenticated
  using ((owner_person_id = private.my_person_id() and private.is_active_me()) or private.is_admin());
create policy file_own_insert on public.file for insert to authenticated
  with check ((owner_person_id = private.my_person_id() and uploaded_by = private.my_person_id()
               and private.is_active_me()) or private.is_admin());

-- Sola lettura per l'interessato; scrittura solo tramite comandi.
create policy status_history_select on public.person_status_history for select to authenticated
  using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin());
create policy path_plan_select on public.path_plan for select to authenticated
  using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin());
create policy path_step_select on public.path_step for select to authenticated
  using (private.is_admin() or exists (select 1 from public.path_plan pl
         where pl.id = plan_id and pl.person_id = private.my_person_id() and private.is_active_me()));
create policy capability_select on public.person_capability for select to authenticated
  using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin());

-- Catalogo: tutti leggono, l'amministratore modifica.
create policy title_catalog_read on public.title_catalog for select to authenticated using (true);
create policy title_catalog_admin on public.title_catalog for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy title_equivalence_read on public.title_equivalence for select to authenticated using (true);
create policy title_equivalence_admin on public.title_equivalence for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Registri: li legge solo l'amministratore; li scrivono solo i comandi.
create policy action_log_admin on public.action_log for select to authenticated using (private.is_admin());
create policy email_log_admin  on public.email_log  for select to authenticated using (private.is_admin());

-- ───────────────────────── Permessi di base ─────────────────────────
-- Il progetto NON espone le tabelle nuove per default: i permessi si danno qui, uno per uno.
revoke all on all tables in schema public from anon;
grant select, insert, update on
  public.person, public.person_role, public.tax_profile, public.person_preferences,
  public.identity_document, public.insurance, public.person_skill, public.person_title,
  public.logbook_entry to authenticated;
grant select, insert on public.file to authenticated;
grant select on
  public.person_status_history, public.path_plan, public.path_step, public.person_capability,
  public.person_title_history, public.title_catalog, public.title_equivalence,
  public.action_log, public.email_log to authenticated;
grant insert, update, delete on public.title_catalog, public.title_equivalence to authenticated;
-- Lo schema privato: le tabelle restano irraggiungibili, si possono solo chiamare le funzioni di controllo.
revoke all on schema private from anon;
revoke all on all tables in schema private from anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_admin(), private.my_person_id(), private.is_active_me() to authenticated;

-- ───────────────────────── Vista: coda "Pronti per Ready" ─────────────────────────
create view public.ready_queue with (security_invoker = true) as
select pl.id as plan_id, pl.person_id, pl.goal_capability, pl.assigned_at,
       max(s.done_at) filter (where s.kind <> 'ready_confirmation') as ready_since
from public.path_plan pl
join public.path_step s on s.plan_id = pl.id
join public.person p on p.id = pl.person_id and p.status in ('in_path','ready')
where pl.status = 'active'
group by pl.id
having bool_and(s.status in ('done','not_required')) filter (where s.kind <> 'ready_confirmation')
   and bool_or(s.kind = 'ready_confirmation' and s.status in ('todo','in_progress'));
grant select on public.ready_queue to authenticated;
