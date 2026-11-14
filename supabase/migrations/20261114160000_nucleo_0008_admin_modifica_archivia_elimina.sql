-- SkillDeck V3 — nucleo: l'amministratore consulta, modifica, archivia ed elimina (deciso dall'owner il 14/11/2026).
--  * Persone, titoli, documenti d'identità e assicurazioni NON si cancellano: si archiviano e si possono ripristinare.
--  * Competenze e righe di logbook dichiarate (errori di battitura) si cancellano davvero; il contenuto resta nel registro.
--  * Ogni scrittura fatta dall'amministratore sulla scheda di un'altra persona finisce nel registro delle azioni.

alter table public.person            add column archived_at timestamptz;
alter table public.person_title      add column archived_at timestamptz;
alter table public.identity_document add column archived_at timestamptz;
alter table public.insurance         add column archived_at timestamptz;

-- Ciò che è archiviato non conta più per "in regola" né per le scadenze.
create or replace function private.compliance_of(p_person uuid, p_until date)
returns table (requirement public.requirement, covered boolean, covered_until date, by_title text)
language sql stable security definer set search_path = '' as $$
  select r.req, best.title_code is not null, best.expires_on, best.title_code
  from unnest(enum_range(null::public.requirement)) as r(req)
  left join lateral (
    select c.code as title_code, pt.expires_on
    from public.person_title pt
    join public.title_catalog c      on c.id = pt.title_id
    join public.title_equivalence e  on e.title_id = c.id and e.covers_requirement = r.req
    where pt.person_id = p_person
      and pt.status in ('declared','verified')
      and pt.archived_at is null
      and pt.file_id is not null
      and (pt.expires_on is null or pt.expires_on >= p_until)
    order by pt.expires_on desc nulls first
    limit 1
  ) best on true
$$;

create or replace function public.expiring(p_days integer default 60)
returns table (person_id uuid, kind text, label text, expires_on date)
language sql stable security definer set search_path = '' as $$
  select x.person_id, x.kind, x.label, x.expires_on
  from (
    select pt.person_id, 'title'::text as kind, c.code as label, pt.expires_on
      from public.person_title pt join public.title_catalog c on c.id = pt.title_id
     where pt.status in ('declared','verified') and pt.archived_at is null
    union all
    select d.person_id, 'identity_document', d.kind::text, d.expires_on from public.identity_document d where d.archived_at is null
    union all
    select i.person_id, 'insurance', i.kind, i.expires_on from public.insurance i where i.archived_at is null
  ) x
  join public.person p on p.id = x.person_id and p.archived_at is null
  where x.expires_on is not null
    and x.expires_on <= current_date + p_days
    and (private.is_admin() or (x.person_id = private.my_person_id() and private.is_active_me()))
  order by x.expires_on
$$;

-- ───────────────────────── Registro delle modifiche dell'amministratore ─────────────────────────
create or replace function private.log_admin_edit(p_action text, p_table text, p_id uuid, p_on_behalf uuid, p_details jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then return; end if;
  insert into public.action_log(actor_person_id, acting_as_person_id, action, target_table, target_id, details)
  values (private.my_person_id(), p_on_behalf, p_action, p_table, p_id, p_details);
end $$;

-- Scatta solo per le scritture dirette dall'applicazione (i comandi scrivono già da soli nel registro).
-- Per le modifiche annota QUALI campi sono cambiati, non i valori: nel registro non finiscono IBAN o codici fiscali.
create or replace function private.audit_admin_edit() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_row    jsonb;
  v_person uuid;
  v_fields jsonb;
begin
  if current_user <> 'authenticated' or not private.is_admin() then return null; end if;
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  v_person := case when tg_table_name = 'person' then (v_row->>'id')::uuid else (v_row->>'person_id')::uuid end;
  if v_person is not distinct from private.my_person_id() then return null; end if;
  if tg_op = 'UPDATE' then
    select jsonb_agg(n.key order by n.key) into v_fields
      from jsonb_each(to_jsonb(new)) n
     where n.key <> 'updated_at' and n.value is distinct from (to_jsonb(old) -> n.key);
    if v_fields is null then return null; end if;
  end if;
  perform private.log_admin_edit('admin_' || lower(tg_op), tg_table_name,
    coalesce((v_row->>'id')::uuid, v_person), v_person,
    case when v_fields is null then null else jsonb_build_object('fields', v_fields) end);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['person','person_title','identity_document','insurance','person_skill',
    'logbook_entry','tax_profile','person_preferences']
  loop
    execute format('create trigger %1$I_audit_admin after insert or update or delete on public.%1$I
                    for each row execute function private.audit_admin_edit()', t);
  end loop;
end $$;

-- ───────────────────────── Comandi: archivia, ripristina, elimina ─────────────────────────
create or replace function public.cmd_archive_row(p_table text, p_id uuid, p_restore boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); n integer;
begin
  if p_table not in ('person','person_title','identity_document','insurance') then
    raise exception 'Questo tipo di dato non si archivia';
  end if;
  if p_table = 'person' and p_id = me then raise exception 'Non puoi archiviare te stesso'; end if;
  execute format('update public.%I set archived_at = %s where id = $1 and archived_at is %s',
                 p_table, case when p_restore then 'null' else 'now()' end, case when p_restore then 'not null' else 'null' end)
    using p_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Riga non trovata'; end if;
  perform private.log_action(me, case when p_restore then 'restore' else 'archive' end, p_table, p_id, null);
end $$;

create or replace function public.cmd_delete_row(p_table text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_old jsonb;
begin
  if p_table = 'person_skill' then
    delete from public.person_skill where id = p_id returning to_jsonb(person_skill.*) into v_old;
  elsif p_table = 'logbook_entry' then
    delete from public.logbook_entry where id = p_id and source <> 'generated' returning to_jsonb(logbook_entry.*) into v_old;
  else
    raise exception 'Questo tipo di dato non si elimina: si archivia';
  end if;
  if v_old is null then raise exception 'Riga non trovata, oppure generata da un ingaggio e quindi non eliminabile'; end if;
  perform private.log_action(me, 'delete', p_table, p_id, v_old);
end $$;

revoke execute on function public.cmd_archive_row(text, uuid, boolean), public.cmd_delete_row(text, uuid) from public, anon;
grant  execute on function public.cmd_archive_row(text, uuid, boolean), public.cmd_delete_row(text, uuid) to authenticated;
revoke execute on function private.log_admin_edit(text, text, uuid, uuid, jsonb), private.audit_admin_edit() from public, anon;
grant  execute on function private.log_admin_edit(text, text, uuid, uuid, jsonb) to authenticated;

-- ───────────────────────── Controlli contro le distrazioni (chiesti dall'owner il 14/11/2026) ─────────────────────────
-- Valgono per tutti, amministratore compreso, e solo sui valori che si stanno scrivendo ora.
create or replace function private.check_plausible() returns trigger
language plpgsql set search_path = '' as $$
declare r jsonb := to_jsonb(new); o jsonb := '{}'::jsonb; d date;
begin
  if tg_op = 'UPDATE' then o := to_jsonb(old); end if;
  if tg_table_name = 'person' then
    if new.birth_date is not null and new.birth_date is distinct from (o->>'birth_date')::date then
      if new.birth_date > current_date then raise exception 'La data di nascita è nel futuro: controlla l''anno.'; end if;
      if new.birth_date > current_date - interval '16 years' then raise exception 'Con questa data di nascita avresti meno di 16 anni: controlla l''anno.'; end if;
      if new.birth_date < date '1925-01-01' then raise exception 'La data di nascita è troppo lontana: controlla l''anno.'; end if;
    end if;
    if new.phone is not null and new.phone is distinct from (o->>'phone')
       and length(regexp_replace(new.phone, '[^0-9]', '', 'g')) not between 8 and 15 then
      raise exception 'Il numero di telefono non sembra completo: servono da 8 a 15 cifre.';
    end if;
  elsif tg_table_name in ('person_title','identity_document','insurance') then
    d := (r->>'expires_on')::date;
    if d is not null and d is distinct from (o->>'expires_on')::date then
      if d > current_date + interval '30 years' then raise exception 'La scadenza è troppo lontana: controlla l''anno.'; end if;
      if d < date '2000-01-01' then raise exception 'La scadenza è troppo indietro nel tempo: controlla l''anno.'; end if;
    end if;
    if (r->>'issued_on') is not null then
      if (r->>'issued_on')::date > current_date then raise exception 'La data di rilascio è nel futuro: controlla l''anno.'; end if;
      if d is not null and d < (r->>'issued_on')::date then raise exception 'La scadenza viene prima della data di rilascio.'; end if;
    end if;
  elsif tg_table_name = 'logbook_entry' then
    if new.source = 'declared' and (r - 'updated_at') is distinct from (o - 'updated_at') then
      if new.to_date > current_date then raise exception 'Una navigazione si registra quando è finita: la data di fine è nel futuro.'; end if;
      if new.from_date < date '1950-01-01' then raise exception 'La data di inizio è troppo lontana: controlla l''anno.'; end if;
      if new.to_date - new.from_date > 366 then raise exception 'La navigazione dura più di un anno: controlla le date.'; end if;
      if new.days   > new.to_date - new.from_date + 1 then raise exception 'I giorni sono più di quelli compresi fra le due date.'; end if;
      if new.nights > new.to_date - new.from_date + 1 then raise exception 'Le notti sono più di quelle comprese fra le due date.'; end if;
      if new.miles  > (new.to_date - new.from_date + 1) * 300 then raise exception 'Le miglia sono troppe per questi giorni: controlla il numero.'; end if;
    end if;
  elsif tg_table_name = 'tax_profile' then
    if new.tax_code is not null and new.tax_code is distinct from (o->>'tax_code') and new.tax_code !~ '^[A-Z0-9]{16}$' then
      raise exception 'Il codice fiscale deve avere 16 caratteri fra lettere e numeri.';
    end if;
    if new.vat_number is not null and new.vat_number is distinct from (o->>'vat_number') and new.vat_number !~ '^[0-9]{11}$' then
      raise exception 'La partita IVA italiana ha 11 cifre.';
    end if;
    if new.iban is not null and new.iban is distinct from (o->>'iban') and new.iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
      raise exception 'L''IBAN non ha la forma giusta: controlla di averlo copiato tutto.';
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['person','person_title','identity_document','insurance','logbook_entry','tax_profile']
  loop
    execute format('create trigger %1$I_check_plausible before insert or update on public.%1$I
                    for each row execute function private.check_plausible()', t);
  end loop;
end $$;
revoke execute on function private.check_plausible() from public, anon;
