-- 0015 · Salute del sistema: permessi più stretti, registro degli errori, controllo automatico di sicurezza e integrità.

-- ───────── 1. Permessi: chi non ha fatto l'accesso (anon) non riceve più nulla in automatico.
-- Le regole riga per riga (RLS) proteggevano già i dati; qui togliamo anche il permesso di base, come seconda serratura.
revoke all on all tables in schema public from anon;
grant select on public.option_list to anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- ───────── 2. Indici sulle chiavi più usate (letture per persona).
create index if not exists identity_document_person on public.identity_document(person_id);
create index if not exists insurance_person on public.insurance(person_id);
create index if not exists logbook_entry_person on public.logbook_entry(person_id, from_date);
create index if not exists person_title_person on public.person_title(person_id);
create index if not exists person_status_history_person on public.person_status_history(person_id);
create index if not exists file_owner on public.file(owner_person_id);

-- ───────── 3. Registro degli errori incontrati dagli utenti nell'applicazione.
create table public.app_error (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  person_id   uuid references public.person(id),
  source      text not null check (source in ('schermata','salvataggio','rete','altro')),
  message     text not null,
  shown       text,
  code        text,
  page        text,
  app_version text,
  device      text,
  resolved_at timestamptz,
  note        text
);
create index app_error_at on public.app_error(at desc);
alter table public.app_error enable row level security;
create policy app_error_admin on public.app_error for all to authenticated using (private.is_admin()) with check (private.is_admin());
revoke all on public.app_error from anon, authenticated;
grant select, update, delete on public.app_error to authenticated;

-- Chiunque usi l'app (anche durante la candidatura, prima dell'accesso) può segnalare un errore, ma solo tramite questa porta:
-- testi accorciati, nessun dato del modulo, e un tetto orario contro gli abusi.
create or replace function public.log_error(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_recent integer;
begin
  select count(*) into v_recent from public.app_error where at > now() - interval '1 hour';
  if v_recent >= 300 then return; end if;
  insert into public.app_error(person_id, source, message, shown, code, page, app_version, device)
  values (private.my_person_id(),
          case when p->>'source' in ('schermata','salvataggio','rete','altro') then p->>'source' else 'altro' end,
          left(coalesce(nullif(p->>'message',''), 'Errore senza testo'), 1000), left(p->>'shown', 500), left(p->>'code', 40),
          left(p->>'page', 200), left(p->>'app_version', 80), left(p->>'device', 200));
end $$;
revoke execute on function public.log_error(jsonb) from public;
grant execute on function public.log_error(jsonb) to anon, authenticated;

-- ───────── 4. Il controllo: una riga per ogni verifica, con quanti casi ha trovato e cosa fare.
-- level: ok (nessun caso), info (da sapere), warn (da guardare), bad (da sistemare subito).
create or replace function public.system_health()
returns table(area text, code text, title text, level text, found integer, detail text, advice text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.require_admin();
  return query
  with checks(area, code, title, sev, found, detail, advice) as (
    -- Sicurezza
    select 'Sicurezza', 'rls_off', 'Tabelle senza protezione riga per riga', 'bad', count(*)::int, string_agg(c.relname, ', '),
           'Ogni tabella deve avere la protezione accesa: va corretto subito con una migrazione.'
      from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    union all
    select 'Sicurezza', 'rls_no_policy', 'Tabelle protette ma senza regole di accesso', 'warn', count(*)::int, string_agg(c.relname, ', '),
           'Senza regole nessuno le legge: va bene solo se è voluto.'
      from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and not exists (select 1 from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
    union all
    select 'Sicurezza', 'anon_write', 'Tabelle scrivibili senza accesso', 'bad', count(distinct g.table_name)::int, string_agg(distinct g.table_name, ', '),
           'Chi non ha fatto l''accesso non deve poter scrivere in nessuna tabella.'
      from information_schema.role_table_grants g
     where g.table_schema = 'public' and g.grantee = 'anon' and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
    union all
    select 'Sicurezza', 'anon_read', 'Tabelle leggibili senza accesso oltre agli elenchi pubblici', 'bad', count(distinct g.table_name)::int, string_agg(distinct g.table_name, ', '),
           'Senza accesso si devono leggere solo gli elenchi delle scelte.'
      from information_schema.role_table_grants g
     where g.table_schema = 'public' and g.grantee = 'anon' and g.privilege_type = 'SELECT' and g.table_name not in ('option_list')
    union all
    select 'Sicurezza', 'anon_function', 'Funzioni richiamabili senza accesso oltre a quelle previste', 'bad', count(*)::int, string_agg(p.proname, ', '),
           'Senza accesso servono solo le opzioni della candidatura e la segnalazione degli errori.'
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('application_options', 'log_error')
    union all
    select 'Sicurezza', 'definer_no_path', 'Funzioni privilegiate senza percorso bloccato', 'bad', count(*)::int, string_agg(p.proname, ', '),
           'Ogni funzione privilegiata deve avere il percorso di ricerca vuoto.'
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public','private') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%')
    union all
    select 'Sicurezza', 'admins', 'Amministratori', 'info', count(*)::int, null, 'Controlla che siano solo le persone che conosci.' from private.admin_user
    union all
    select 'Sicurezza', 'file_wrong_owner', 'File collegati alla scheda di un''altra persona', 'bad', count(*)::int, null,
           'Un documento deve appartenere alla stessa persona della riga che lo usa.'
      from (select t.person_id, t.file_id from public.person_title t where t.file_id is not null
            union all select d.person_id, d.file_id from public.identity_document d where d.file_id is not null
            union all select i.person_id, i.file_id from public.insurance i where i.file_id is not null
            union all select r.person_id, r.file_id from public.reference_letter r where r.file_id is not null
            union all select p.id, p.photo_file_id from public.person p where p.photo_file_id is not null) u
      join public.file f on f.id = u.file_id where f.owner_person_id <> u.person_id

    -- Persone e accessi
    union all
    select 'Persone', 'auth_no_person', 'Accessi creati senza una scheda persona', 'warn', count(*)::int, null,
           'Di solito è una candidatura iniziata e non finita, oppure un''email non confermata.'
      from auth.users u where not exists (select 1 from public.person p where p.auth_user_id = u.id)
    union all
    select 'Persone', 'person_no_auth', 'Schede senza accesso', 'info', count(*)::int, null, 'Persone inserite a mano che non possono ancora entrare.'
      from public.person p where p.auth_user_id is null and p.archived_at is null
    union all
    select 'Persone', 'dup_email', 'Email usate da più schede', 'bad', count(*)::int, string_agg(x.e, ', '), 'Due schede con la stessa email: una va archiviata.'
      from (select lower(p.email) e from public.person p where p.archived_at is null group by 1 having count(*) > 1) x
    union all
    select 'Persone', 'dup_phone', 'Telefoni usati da più schede', 'warn', count(*)::int, null, 'Può essere un doppione della stessa persona.'
      from (select right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 9) t from public.person p where p.phone is not null and p.archived_at is null group by 1 having count(*) > 1) x
    union all
    select 'Persone', 'dup_name', 'Stesso nome, cognome e data di nascita', 'warn', count(*)::int, string_agg(x.n, ', '), 'Probabile doppione: confronta le due schede.'
      from (select lower(p.first_name || ' ' || p.last_name) n from public.person p where p.archived_at is null and p.birth_date is not null group by 1, p.birth_date having count(*) > 1) x

    -- Percorso
    union all
    select 'Percorso', 'in_path_no_plan', 'In percorso senza un piano attivo', 'bad', count(*)::int, string_agg(p.first_name || ' ' || p.last_name, ', '), 'Apri la scheda e assegna un piano.'
      from public.person p where p.status = 'in_path' and p.archived_at is null
       and not exists (select 1 from public.path_plan pl where pl.person_id = p.id and pl.status = 'active')
    union all
    select 'Percorso', 'many_plans', 'Persone con più piani attivi', 'bad', count(*)::int, null, 'Ne deve restare uno solo.'
      from (select pl.person_id from public.path_plan pl where pl.status = 'active' group by 1 having count(*) > 1) x
    union all
    select 'Percorso', 'plan_no_steps', 'Piani senza passi', 'bad', count(*)::int, null, 'Un piano vuoto non arriva mai a Ready.'
      from public.path_plan pl where not exists (select 1 from public.path_step s where s.plan_id = pl.id)
    union all
    select 'Percorso', 'ready_no_capability', 'Ready senza una capacità attiva', 'warn', count(*)::int, string_agg(p.first_name || ' ' || p.last_name, ', '), 'Chi è Ready deve avere almeno una capacità professionale.'
      from public.person p where p.status = 'ready' and p.family <> 'admin' and p.archived_at is null
       and not exists (select 1 from public.person_capability c where c.person_id = p.id and c.status = 'active')
    union all
    select 'Percorso', 'waiting_long', 'Candidature in attesa da più di 14 giorni', 'warn', count(*)::int, string_agg(p.first_name || ' ' || p.last_name, ', '), 'Fissa il colloquio o prendi una decisione.'
      from public.person p where p.status = 'registered' and p.family <> 'admin' and p.archived_at is null and p.created_at < now() - interval '14 days'
    union all
    select 'Percorso', 'interview_past', 'Colloqui passati non ancora chiusi', 'warn', count(*)::int, null, 'Segnali come fatti oppure spostali.'
      from public.interview_request r where r.status = 'scheduled' and r.scheduled_start < now() - interval '1 day'
    union all
    select 'Percorso', 'memo_late', 'Promemoria in ritardo', 'warn', count(*)::int, null, 'Li trovi nella cabina di regia.'
      from public.person_note m where m.kind = 'memo' and m.done_at is null and m.due_on < current_date

    -- Documenti e file
    union all
    select 'Documenti', 'file_missing', 'File registrati ma assenti dall''archivio', 'bad', count(*)::int, null, 'Il documento risulta caricato ma non si apre: va ricaricato.'
      from public.file f where not exists (select 1 from storage.objects o where o.bucket_id = 'documenti' and o.name = f.storage_path)
    union all
    select 'Documenti', 'object_unregistered', 'File in archivio non registrati', 'warn', count(*)::int, null, 'Caricamenti interrotti a metà: occupano spazio senza servire.'
      from storage.objects o where o.bucket_id = 'documenti' and not exists (select 1 from public.file f where f.storage_path = o.name)
    union all
    select 'Documenti', 'file_orphan', 'File registrati che nessuna scheda usa', 'info', count(*)::int, null, 'Di solito sono versioni sostituite: restano in archivio.'
      from public.file f
     where not exists (select 1 from public.person_title t where t.file_id = f.id) and not exists (select 1 from public.identity_document d where d.file_id = f.id)
       and not exists (select 1 from public.insurance i where i.file_id = f.id) and not exists (select 1 from public.reference_letter r where r.file_id = f.id)
       and not exists (select 1 from public.person p where p.photo_file_id = f.id)
    union all
    select 'Documenti', 'title_no_file', 'Titoli dichiarati o verificati senza il file', 'warn', count(*)::int, null, 'Senza il documento il titolo non vale per essere in regola.'
      from public.person_title t where t.status in ('declared','verified') and t.file_id is null and t.archived_at is null
    union all
    select 'Documenti', 'title_dup', 'Lo stesso titolo caricato due volte dalla stessa persona', 'warn', count(*)::int, null, 'Uno dei due va archiviato.'
      from (select t.person_id, t.title_id from public.person_title t where t.archived_at is null and t.status in ('declared','verified') group by 1, 2 having count(*) > 1) x
    union all
    select 'Documenti', 'title_wait', 'Titoli in attesa di verifica da più di 7 giorni', 'warn', count(*)::int, null, 'Li trovi nella cabina di regia.'
      from public.person_title t where t.status = 'declared' and t.archived_at is null and t.updated_at < now() - interval '7 days'
    union all
    select 'Documenti', 'dates_wrong', 'Scadenze precedenti alla data di rilascio', 'bad', count(*)::int, null, 'Date incoerenti: vanno corrette nella scheda.'
      from (select t.issued_on, t.expires_on from public.person_title t union all select d.issued_on, d.expires_on from public.identity_document d
            union all select i.issued_on, i.expires_on from public.insurance i) x where x.expires_on < x.issued_on

    -- Dati del profilo
    union all
    select 'Dati', 'logbook_overlap', 'Navigazioni che si sovrappongono nello stesso logbook', 'warn', count(*)::int, null, 'Una persona non può essere su due barche negli stessi giorni.'
      from public.logbook_entry a join public.logbook_entry b on b.person_id = a.person_id and b.id > a.id and a.from_date < b.to_date and b.from_date < a.to_date
    union all
    select 'Dati', 'tax_wrong', 'Dati fiscali con una forma non valida', 'warn', count(*)::int, null, 'Codice fiscale, partita IVA o IBAN da ricontrollare.'
      from public.tax_profile t where (t.tax_code is not null and t.tax_code !~ '^[A-Z0-9]{16}$') or (t.vat_number is not null and t.vat_number !~ '^[0-9]{11}$')
         or (t.iban is not null and t.iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$')
    union all
    select 'Dati', 'list_unknown', 'Voci del curriculum non presenti negli elenchi', 'info', count(*)::int, null, 'Voci scritte a mano con "Altro": valuta se aggiungerle agli elenchi.'
      from public.person_skill s where s.kind::text in ('area','technical','soft','hobby','sport','boat_type')
       and not exists (select 1 from public.option_list o where o.label = s.value)

    -- Funzionamento
    union all
    select 'Funzionamento', 'errors_open', 'Errori incontrati dagli utenti negli ultimi 7 giorni, non ancora chiusi', 'warn', count(*)::int, null, 'Li trovi qui sotto nel registro degli errori.'
      from public.app_error e where e.resolved_at is null and e.at > now() - interval '7 days'
    union all
    select 'Funzionamento', 'email_blocked', 'Email bloccate o non riuscite negli ultimi 7 giorni', 'warn', count(*)::int, null, 'Controlla il registro degli invii.'
      from public.email_log m where m.status in ('failed','blocked') and m.created_at > now() - interval '7 days'
  )
  select c.area, c.code, c.title, case when c.found = 0 then 'ok' else c.sev end, c.found, c.detail, c.advice from checks c;
end $$;
revoke execute on function public.system_health() from public, anon;
grant execute on function public.system_health() to authenticated;

-- ───────── 5. Storico dei controlli: ogni esecuzione lascia una riga, per vedere se la situazione migliora o peggiora.
create table public.health_run (
  id       uuid primary key default gen_random_uuid(),
  at       timestamptz not null default now(),
  run_by   uuid references public.person(id),
  bad      integer not null,
  warn     integer not null,
  results  jsonb not null
);
alter table public.health_run enable row level security;
create policy health_run_admin on public.health_run for select to authenticated using (private.is_admin());
revoke all on public.health_run from anon, authenticated;
grant select on public.health_run to authenticated;

create or replace function public.cmd_run_health() returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_id uuid;
begin
  insert into public.health_run(run_by, bad, warn, results)
  select me, count(*) filter (where h.level = 'bad'), count(*) filter (where h.level = 'warn'),
         coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb)
    from public.system_health() h
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.cmd_run_health() from public, anon;
grant execute on function public.cmd_run_health() to authenticated;
