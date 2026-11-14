-- SkillDeck V3 — nucleo: ciò che serve al modulo di candidatura prima dell'accesso.
-- Una sola funzione pubblica, senza dati personali: elenco dei titoli, fasce dei colloqui, orari già occupati.
create or replace function public.application_options()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'titles', (select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name_it, 'issuer', c.issuer, 'category', c.category,
                        'skipper', c.for_skipper, 'crew', c.for_crew) order by c.sort, c.name_it), '[]'::jsonb)
                 from public.title_catalog c where c.is_active and (c.for_skipper or c.for_crew)),
    'settings', (select jsonb_build_object('weekdays', s.weekdays, 'start', to_char(s.start_time, 'HH24:MI'), 'end', to_char(s.end_time, 'HH24:MI'),
                        'slot_minutes', s.slot_minutes, 'horizon_days', s.horizon_days) from public.interview_settings s),
    'busy', (select coalesce(jsonb_agg(jsonb_build_object('start', r.scheduled_start, 'minutes', r.duration_minutes)), '[]'::jsonb)
               from public.interview_request r where r.status = 'scheduled' and r.scheduled_start > now() - interval '2 hours')
  )
$$;
revoke execute on function public.application_options() from public;
grant execute on function public.application_options() to anon, authenticated;
