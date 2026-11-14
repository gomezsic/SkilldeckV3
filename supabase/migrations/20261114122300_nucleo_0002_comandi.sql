-- SkillDeck V3 — nucleo, comandi dell'amministratore (applicati al collaudo il 14/11/2026)
-- Ogni comando: controlla che chi chiama sia amministratore, fa una cosa sola,
-- scrive nel registro delle azioni. Sono le uniche porte per cambiare stato,
-- piano, passi, capacità, sospensione e verifica dei titoli.
-- Le email di servizio (per esempio il benvenuto fra i Ready) partono dall'applicazione
-- dopo il comando, rispettando il piano email: qui non si spedisce nulla.

create or replace function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare me uuid;
begin
  if not private.is_admin() then
    raise exception 'Comando riservato all''amministratore' using errcode = '42501';
  end if;
  select p.id into me from public.person p where p.auth_user_id = auth.uid();
  return me;
end $$;

create or replace function private.log_action(p_actor uuid, p_action text, p_table text, p_id uuid, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.action_log(actor_person_id, action, target_table, target_id, details)
  values (p_actor, p_action, p_table, p_id, p_details);
$$;

create or replace function private.set_status(p_actor uuid, p_person uuid, p_to public.person_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_from public.person_status;
begin
  select status into v_from from public.person where id = p_person for update;
  if not found then raise exception 'Persona non trovata'; end if;
  if v_from = p_to then return; end if;
  update public.person set status = p_to where id = p_person;
  insert into public.person_status_history(person_id, from_status, to_status, changed_by, reason)
  values (p_person, v_from, p_to, p_actor, p_reason);
end $$;

create or replace function private.create_plan(p_actor uuid, p_person uuid, p_goal public.capability,
                                               p_template public.plan_template, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_plan uuid;
begin
  insert into public.path_plan(person_id, goal_capability, template, assigned_by, note)
  values (p_person, p_goal, p_template, p_actor, p_note) returning id into v_plan;
  insert into public.path_step(plan_id, kind, position, status, done_at, done_by)
  select v_plan, k.kind, k.pos,
         case
           when k.kind = 'interview' then 'done'
           when k.kind = 'ready_confirmation' then 'todo'
           when p_template = 'direct_ready' then 'not_required'
           when p_template = 'career_and_documents' and k.kind = 'test' then 'not_required'
           else 'todo'
         end::public.step_status,
         case when k.kind = 'interview' then now() end,
         case when k.kind = 'interview' then p_actor end
  from (values ('interview'::public.step_kind,1),('test',2),('career',3),('documents',4),('ready_confirmation',5)) as k(kind,pos);
  return v_plan;
end $$;

-- 1. Accetta candidatura: Registrato → In percorso, con il piano scelto.
create or replace function public.cmd_accept_application(p_person uuid, p_goal public.capability,
                                                         p_template public.plan_template, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_plan uuid;
begin
  if (select status from public.person where id = p_person) is distinct from 'registered' then
    raise exception 'Si accetta solo chi è Registrato';
  end if;
  perform private.set_status(me, p_person, 'in_path', null);
  v_plan := private.create_plan(me, p_person, p_goal, p_template, p_note);
  perform private.log_action(me, 'accept_application', 'person', p_person,
                             jsonb_build_object('plan', v_plan, 'goal', p_goal, 'template', p_template));
  return v_plan;
end $$;

-- 2. Non accettare: Registrato → Non accettato, con motivo.
create or replace function public.cmd_reject_application(p_person uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin();
begin
  if (select status from public.person where id = p_person) is distinct from 'registered' then
    raise exception 'Si può non accettare solo chi è Registrato';
  end if;
  perform private.set_status(me, p_person, 'not_accepted', p_reason);
  perform private.log_action(me, 'reject_application', 'person', p_person, null);
end $$;

-- 3 e 6. Aggiorna un passo / Rimanda (riaprire un passo con nota fa uscire dalla coda).
create or replace function public.cmd_update_step(p_step uuid, p_status public.step_status,
                                                  p_note text default null, p_outcome_ref uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_kind public.step_kind; v_old public.step_status;
begin
  select kind, status into v_kind, v_old from public.path_step where id = p_step for update;
  if not found then raise exception 'Passo non trovato'; end if;
  if v_kind = 'ready_confirmation' then
    raise exception 'La conferma Ready si dà solo con il comando Conferma Ready';
  end if;
  update public.path_step
     set status = p_status,
         note = coalesce(p_note, note),
         outcome_ref = coalesce(p_outcome_ref, outcome_ref),
         done_at = case when p_status = 'done' then now() end,
         done_by = case when p_status = 'done' then me end
   where id = p_step;
  perform private.log_action(me, 'update_step', 'path_step', p_step,
                             jsonb_build_object('kind', v_kind, 'from', v_old, 'to', p_status, 'note', p_note));
end $$;

-- 5. Conferma Ready: solo se tutti gli altri passi sono chiusi.
create or replace function public.cmd_confirm_ready(p_plan uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_person uuid; v_goal public.capability;
begin
  select person_id, goal_capability into v_person, v_goal
    from public.path_plan where id = p_plan and status = 'active' for update;
  if not found then raise exception 'Piano attivo non trovato'; end if;
  if exists (select 1 from public.path_step
             where plan_id = p_plan and kind <> 'ready_confirmation' and status not in ('done','not_required')) then
    raise exception 'Ci sono ancora passi aperti: la persona non è pronta per Ready';
  end if;
  update public.path_step set status = 'done', done_at = now(), done_by = me
   where plan_id = p_plan and kind = 'ready_confirmation';
  update public.path_plan set status = 'completed' where id = p_plan;
  perform private.set_status(me, v_person, 'ready', null);
  insert into public.person_capability(person_id, capability, status, granted_by, granted_at)
  values (v_person, v_goal, 'active', me, now())
  on conflict (person_id, capability)
  do update set status = 'active', granted_by = me, granted_at = now(), revoked_at = null, revoke_reason = null;
  perform private.log_action(me, 'confirm_ready', 'person', v_person, jsonb_build_object('plan', p_plan, 'goal', v_goal));
end $$;

-- 7. Porta direttamente a Ready (skipper esperto): piano "direttamente Ready" e conferma in un gesto.
create or replace function public.cmd_direct_ready(p_person uuid, p_goal public.capability, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_plan uuid; v_status public.person_status;
begin
  select status into v_status from public.person where id = p_person;
  if v_status not in ('registered','in_path') then
    raise exception 'Solo da Registrato o In percorso';
  end if;
  if v_status = 'registered' then perform private.set_status(me, p_person, 'in_path', null); end if;
  v_plan := private.create_plan(me, p_person, p_goal, 'direct_ready', p_note);
  perform public.cmd_confirm_ready(v_plan);
  return v_plan;
end $$;

-- 9. Apri nuovo piano (promozione, per esempio da Staff a Skipper). Lo stato non cambia.
create or replace function public.cmd_open_plan(p_person uuid, p_goal public.capability,
                                                p_template public.plan_template, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_plan uuid;
begin
  if (select status from public.person where id = p_person) not in ('in_path','ready') then
    raise exception 'Un nuovo piano si apre solo a chi è In percorso o Ready';
  end if;
  v_plan := private.create_plan(me, p_person, p_goal, p_template, p_note);
  perform private.log_action(me, 'open_plan', 'person', p_person, jsonb_build_object('plan', v_plan, 'goal', p_goal));
  return v_plan;
end $$;

-- Conferma di un piano di promozione: la persona è già Ready, riceve la nuova capacità.
-- (cmd_confirm_ready funziona anche in questo caso: lo stato resta Ready.)

-- 8. Assegna o togli una capacità (compresa Formatore, solo a chi è Ready).
create or replace function public.cmd_grant_capability(p_person uuid, p_capability public.capability)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin();
begin
  if (select status from public.person where id = p_person) is distinct from 'ready' then
    raise exception 'Le capacità si assegnano solo a chi è Ready';
  end if;
  insert into public.person_capability(person_id, capability, status, granted_by, granted_at)
  values (p_person, p_capability, 'active', me, now())
  on conflict (person_id, capability)
  do update set status = 'active', granted_by = me, granted_at = now(), revoked_at = null, revoke_reason = null;
  perform private.log_action(me, 'grant_capability', 'person', p_person, jsonb_build_object('capability', p_capability));
end $$;

create or replace function public.cmd_revoke_capability(p_person uuid, p_capability public.capability, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin();
begin
  update public.person_capability set status = 'revoked', revoked_at = now(), revoke_reason = p_reason
   where person_id = p_person and capability = p_capability;
  if not found then raise exception 'Capacità non trovata'; end if;
  perform private.log_action(me, 'revoke_capability', 'person', p_person, jsonb_build_object('capability', p_capability));
end $$;

-- 10. Sospendi / riattiva per i nuovi incarichi. Il motivo resta nello schema privato.
create or replace function public.cmd_hold_start(p_person uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin();
begin
  insert into private.assignment_hold(person_id, reason, started_by) values (p_person, p_reason, me);
  perform private.log_action(me, 'hold_start', 'person', p_person, null);  -- il motivo NON va nel registro
end $$;

create or replace function public.cmd_hold_end(p_person uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin();
begin
  update private.assignment_hold set ended_at = now(), ended_by = me
   where person_id = p_person and ended_at is null;
  if not found then raise exception 'Nessuna sospensione attiva'; end if;
  perform private.log_action(me, 'hold_end', 'person', p_person, null);
end $$;

create or replace function public.admin_list_holds(p_person uuid default null)
returns table (person_id uuid, reason text, started_at timestamptz, ended_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query select h.person_id, h.reason, h.started_at, h.ended_at
               from private.assignment_hold h
               where p_person is null or h.person_id = p_person
               order by h.started_at desc;
end $$;

-- Per le regole di candidatura: risponde solo sì o no, mai il motivo.
create or replace function private.has_open_hold(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.assignment_hold h where h.person_id = p_person and h.ended_at is null) $$;

-- 11. Escludi: da qualsiasi stato, con motivo. L'accesso si blocca perché le regole escludono gli Esclusi.
create or replace function public.cmd_exclude(p_person uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin();
begin
  perform private.set_status(me, p_person, 'excluded', p_reason);
  update public.path_plan set status = 'closed' where person_id = p_person and status = 'active';
  perform private.log_action(me, 'exclude', 'person', p_person, null);
end $$;

-- 12. Verifica o rifiuta un titolo.
create or replace function public.cmd_verify_title(p_title uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin();
begin
  update public.person_title set status = 'verified', rejection_reason = null
   where id = p_title and status = 'declared' and file_id is not null;
  if not found then raise exception 'Si verifica solo un titolo dichiarato e con il file caricato'; end if;
  insert into public.person_title_history(person_title_id, event, by_person_id) values (p_title, 'verified', me);
  perform private.log_action(me, 'verify_title', 'person_title', p_title, null);
end $$;

create or replace function public.cmd_reject_title(p_title uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin();
begin
  update public.person_title set status = 'rejected', rejection_reason = p_reason
   where id = p_title and status in ('declared','verified');
  if not found then raise exception 'Titolo non trovato o non rifiutabile'; end if;
  insert into public.person_title_history(person_title_id, event, by_person_id, note) values (p_title, 'rejected', me, p_reason);
  perform private.log_action(me, 'reject_title', 'person_title', p_title, null);
end $$;

-- ───────────────────────── Permessi ─────────────────────────
-- Le funzioni nascono eseguibili da tutti: lo togliamo e lo ridiamo solo a chi ha fatto l'accesso.
-- Chi non è amministratore viene comunque fermato da require_admin().
revoke execute on all functions in schema public  from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function private.is_admin(), private.my_person_id(), private.is_active_me() to authenticated;
