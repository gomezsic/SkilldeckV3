-- SkillDeck V3 — nucleo: catalogo dei titoli, equivalenze ufficiali e regola "in regola"
-- Regole confermate dall'owner il 12/11/2026:
--  * comando: patente nautica senza limiti dalla costa (vela e motore) o titolo superiore;
--    la patente entro 12 miglia NON basta;
--  * certificazioni minime: SRC e First Aid;
--  * Ufficiale di 2ª classe del diporto copre anche SRC e First Aid;
--  * Yachtmaster Offshore/Ocean e MCA Master 200GT e superiori coprono anche SRC (First Aid resta richiesto);
--  * un titolo vale se è dichiarato o verificato, ha il file caricato e non è scaduto alla data richiesta.
-- Ogni copertura, anche quella "diretta", è una riga di title_equivalence: una sola regola, un solo posto.

insert into public.title_catalog (code, name_it, name_en, category, command_level) values
  ('PATENTE_12M', 'Patente nautica entro 12 miglia',                       'Boat licence within 12 miles',            'command', 1),
  ('PATENTE_SL',  'Patente nautica senza limiti dalla costa, vela e motore','Boat licence without limits, sail and motor','command', 2),
  ('UFF_2CL',     'Ufficiale di 2ª classe del diporto',                    'Yacht Officer 2nd class (Italy)',         'command', 3),
  ('YM_OFFSHORE', 'Yachtmaster Offshore',                                  'Yachtmaster Offshore',                    'command', 4),
  ('YM_OCEAN',    'Yachtmaster Ocean',                                     'Yachtmaster Ocean',                       'command', 5),
  ('MCA_200',     'MCA Master 200GT',                                      'MCA Master 200GT',                        'command', 6),
  ('MCA_500',     'MCA Master 500GT',                                      'MCA Master 500GT',                        'command', 7),
  ('MCA_3000',    'MCA Master 3000GT',                                     'MCA Master 3000GT',                       'command', 8),
  ('SRC',         'Certificato radio SRC',                                 'Short Range Certificate (SRC)',           'radio',     null),
  ('FIRST_AID',   'First Aid',                                             'First Aid',                               'first_aid', null);

insert into public.title_equivalence (title_id, covers_requirement)
select c.id, r.req::public.requirement
from public.title_catalog c
join (values
  ('PATENTE_SL','command'),
  ('UFF_2CL','command'),    ('UFF_2CL','src'),    ('UFF_2CL','first_aid'),
  ('YM_OFFSHORE','command'),('YM_OFFSHORE','src'),
  ('YM_OCEAN','command'),   ('YM_OCEAN','src'),
  ('MCA_200','command'),    ('MCA_200','src'),
  ('MCA_500','command'),    ('MCA_500','src'),
  ('MCA_3000','command'),   ('MCA_3000','src'),
  ('SRC','src'),
  ('FIRST_AID','first_aid')
) as r(code, req) on r.code = c.code;

-- Per ogni requisito: è coperto fino alla data richiesta? fino a quando? da quale titolo?
create or replace function private.compliance_of(p_person uuid, p_until date)
returns table (requirement public.requirement, covered boolean, covered_until date, by_title text)
language sql stable security definer set search_path = '' as $$
  select r.req,
         best.title_code is not null,
         best.expires_on,
         best.title_code
  from unnest(enum_range(null::public.requirement)) as r(req)
  left join lateral (
    select c.code as title_code, pt.expires_on
    from public.person_title pt
    join public.title_catalog c      on c.id = pt.title_id
    join public.title_equivalence e  on e.title_id = c.id and e.covers_requirement = r.req
    where pt.person_id = p_person
      and pt.status in ('declared','verified')
      and pt.file_id is not null
      and (pt.expires_on is null or pt.expires_on >= p_until)
    order by pt.expires_on desc nulls first
    limit 1
  ) best on true
$$;

-- La mia situazione (o quella di chiunque, se sono amministratore).
create or replace function public.compliance(p_person uuid default null, p_until date default current_date)
returns table (requirement public.requirement, covered boolean, covered_until date, by_title text)
language plpgsql stable security definer set search_path = '' as $$
declare v_person uuid := coalesce(p_person, private.my_person_id());
begin
  if v_person is null then raise exception 'Persona non trovata'; end if;
  if v_person <> private.my_person_id() and not private.is_admin() then
    raise exception 'Puoi vedere solo la tua situazione' using errcode = '42501';
  end if;
  if not private.is_active_me() and not private.is_admin() then
    raise exception 'Accesso non consentito' using errcode = '42501';
  end if;
  return query select * from private.compliance_of(v_person, p_until);
end $$;

-- "In regola come skipper fino a D": tutti e tre i requisiti coperti.
create or replace function public.is_compliant(p_person uuid default null, p_until date default current_date)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(bool_and(c.covered), false) from public.compliance(p_person, p_until) c
$$;

-- Scadenze nei prossimi N giorni: titoli, documenti, assicurazioni (le mie, o di tutti se amministratore).
create or replace function public.expiring(p_days integer default 60)
returns table (person_id uuid, kind text, label text, expires_on date)
language sql stable security definer set search_path = '' as $$
  select x.person_id, x.kind, x.label, x.expires_on
  from (
    select pt.person_id, 'title'::text as kind, c.code as label, pt.expires_on
      from public.person_title pt join public.title_catalog c on c.id = pt.title_id
     where pt.status in ('declared','verified')
    union all
    select d.person_id, 'identity_document', d.kind::text, d.expires_on from public.identity_document d
    union all
    select i.person_id, 'insurance', i.kind, i.expires_on from public.insurance i
  ) x
  where x.expires_on is not null
    and x.expires_on <= current_date + p_days
    and (private.is_admin() or (x.person_id = private.my_person_id() and private.is_active_me()))
  order by x.expires_on
$$;

revoke execute on function public.compliance(uuid, date), public.is_compliant(uuid, date), public.expiring(integer) from public, anon;
revoke execute on function private.compliance_of(uuid, date) from public, anon;
grant execute on function public.compliance(uuid, date), public.is_compliant(uuid, date), public.expiring(integer) to authenticated;
