-- SkillDeck V3 — nucleo: registrazione. Chi ha creato l'accesso apre da sé la propria scheda,
-- che nasce sempre "Registrato". Stato e famiglia non li sceglie l'utente: la famiglia deriva
-- da ciò per cui ci si candida; l'armatore non passa di qui (solo su invito).
create or replace function public.register_me(
  p_first_name text, p_last_name text, p_applied_as public.applied_as,
  p_phone text default null, p_language public.ui_language default 'it', p_privacy_consent boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_email text; v_id uuid; v_family public.family;
begin
  if v_uid is null then raise exception 'Accesso richiesto' using errcode = '42501'; end if;
  if exists (select 1 from public.person where auth_user_id = v_uid) then
    raise exception 'Sei già registrato';
  end if;
  if nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null then
    raise exception 'Nome e cognome sono obbligatori';
  end if;
  if not coalesce(p_privacy_consent, false) then
    raise exception 'Serve il consenso alla privacy';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null then raise exception 'Email non trovata'; end if;
  if exists (select 1 from public.person where lower(email) = v_email) then
    raise exception 'Esiste già una scheda con questa email: contatta SkillDeck';
  end if;
  v_family := case when p_applied_as in ('crew','staff') then 'crew_staff' else 'skipper' end;

  insert into public.person(auth_user_id, first_name, last_name, email, phone, ui_language,
                            family, family_source, family_set_at, status, applied_as)
  values (v_uid, btrim(p_first_name), btrim(p_last_name), v_email, nullif(btrim(p_phone), ''), p_language,
          v_family, 'registration', now(), 'registered', p_applied_as)
  returning id into v_id;

  insert into public.person_status_history(person_id, from_status, to_status, changed_by, reason)
  values (v_id, null, 'registered', v_id, 'Registrazione');
  insert into public.person_preferences(person_id, privacy_consent_at) values (v_id, now());
  perform private.log_action(v_id, 'register', 'person', v_id, jsonb_build_object('applied_as', p_applied_as));
  return v_id;
end $$;

revoke execute on function public.register_me(text, text, public.applied_as, text, public.ui_language, boolean) from public, anon;
grant execute on function public.register_me(text, text, public.applied_as, text, public.ui_language, boolean) to authenticated;
