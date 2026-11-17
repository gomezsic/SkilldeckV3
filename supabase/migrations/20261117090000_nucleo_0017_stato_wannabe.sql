-- 0017 · Il primo stato della persona si chiama "Wannabe" (decisione dell'owner del 17/11/2026).
-- Nel database il valore resta 'registered': cambia solo il nome che le persone leggono.
-- Qui si aggiornano i tre messaggi dei comandi che lo citavano. Nessun dato viene toccato.
do $$
declare f record;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('cmd_accept_application', 'cmd_reject_application', 'cmd_direct_ready')
  loop
    execute replace(replace(replace(pg_get_functiondef(f.oid),
      'Si accetta solo chi è Registrato', 'Si accetta solo chi è Wannabe'),
      'Si può non accettare solo chi è Registrato', 'Si può non accettare solo chi è Wannabe'),
      'Solo da Registrato o In percorso', 'Solo da Wannabe o In percorso');
  end loop;
end $$;
