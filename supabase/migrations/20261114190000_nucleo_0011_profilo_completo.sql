-- SkillDeck V3 — nucleo: profilo completo (curriculum, schede dei titoli, logbook esteso, referenze)
-- e elenchi modificabili dall'amministratore (area Impostazioni). Deciso dall'owner il 14/11/2026.

-- ───────── Elenchi: tutte le scelte a tendina o a bottoni stanno qui, una riga per voce.
create table public.option_list (
  id          uuid primary key default gen_random_uuid(),
  list        text not null,
  label       text not null check (length(btrim(label)) between 1 and 120),
  group_label text,
  sort        smallint not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (list, label)
);
alter table public.option_list enable row level security;
create policy option_list_read on public.option_list for select to anon, authenticated using (true);
create policy option_list_admin on public.option_list for all to authenticated using (private.is_admin()) with check (private.is_admin());
grant select on public.option_list to anon, authenticated;
grant insert, update, delete on public.option_list to authenticated;
create trigger option_list_touch before update on public.option_list for each row execute function private.touch_updated_at();

insert into public.option_list (list, group_label, label, sort)
select v.list, v.grp, x.label, (x.ord * 10)::smallint
from (values
  ('title_group', null, array['Abilitazione al Comando','Sicurezza','Comunicazione','Visite Mediche','Corso RYA','Meteo','Gestione personale','Professionale','Altro']),
  ('issuer', null, array['RYA','RYA - Royal Yachting Association','RYA / Autorità','RYA / Centri privati','RYA / Ministero Comunicazioni','Ministero delle Infrastrutture e dei Trasporti (Italia)','Capitaneria di Porto','Autorità Marittima Italiana / MCA','MCA – Maritime & Coastguard Agency','UK Maritime and Coastguard Agency (MCA)','IMO','IMO / Autorità marittime nazionali','IMO / Autorità nazionali','Autorità nazionale','Transport Malta','Ministero della Salute','Ministero delle Imprese MIMIT (ex Ministero delle Poste)','IRC / Croce Rossa Italiana / Enti accreditati 118','Highfield (HABC) / City & Guilds','Centri nautici riconosciuti','Water Tribe','Varie']),
  ('language', null, array['Italiano','Inglese','Francese','Spagnolo','Tedesco','Greco','Croato','Portoghese','Russo']),
  ('language_level', null, array['Elementare','Buono','Certificato']),
  ('hobby', null, array['Cucina','Fotografia','Lettura','Informatica','Meteo','Meccanica']),
  ('sport', null, array['Vela','Nuoto','Scuba','Windsurf','Kite Surf','Wing Foil','Bike']),
  ('zone', 'Mediterraneo', array['Cipro','Turchia','Dodecanneso','Cicladi','Sporadi','Saronico','Peloponneso','Ioniche','Montenegro','Dalmazia','Incoronate','Istria','Adriatico costa Italiana','Eolie','Egadi','Pontine','Golfo di Napoli','Sardegna','Corsica','Arcipelago Toscano','Costa Azzurra','Baleari']),
  ('zone', 'Caraibi', array['Bahamas','Cuba','Turks and Caicos','Belize','Antigua / St Martin','Martinica / Guadalupe','Grenadine','Los Roques']),
  ('zone', 'Oceano Indiano e Pacifico', array['Madagascar','Seychelles','Thailandia']),
  ('technical_skill', null, array['Manovre in porto e in rada','Ancoraggi avanzati','Pianificazione rotta e lettura GRIB','Gestione emergenze e sicurezza','Manutenzione motore diesel','Reefing e regolazioni vela','Conduzione con vento forte','Navigazione notturna','Elettronica di bordo','Comunicazioni VHF','Primo soccorso a bordo','Gestione equipaggio']),
  ('soft_skill', null, array['Leadership calma e positiva','Comunicazione chiara e rassicurante','Problem solving sotto stress','Gestione gruppi eterogenei','Pianificazione meticolosa','Attenzione ai dettagli','Flessibilità e adattamento','Pazienza e diplomazia']),
  ('boat_category', 'Monoscafi a vela', array['Monoscafo a vela · Cruiser 35-42 piedi','Monoscafo a vela · Performance 35-42 piedi','Monoscafo a vela · Cruiser 43-54 piedi','Monoscafo a vela · Performance 43-54 piedi','Monoscafo a vela · Cruiser +55 piedi','Monoscafo a vela · Performance +55 piedi']),
  ('boat_category', 'Catamarani a vela', array['Catamarano a vela · Cruiser 35-42 piedi','Catamarano a vela · Performance 35-42 piedi','Catamarano a vela · Cruiser 43-54 piedi','Catamarano a vela · Performance 43-54 piedi','Catamarano a vela · Cruiser +55 piedi','Catamarano a vela · Performance +55 piedi']),
  ('boat_category', 'Barche a motore', array['Barca a motore · Yacht sino a 42 piedi','Barca a motore · Yacht sino a 50 piedi','Barca a motore · Navi (oltre 24 m, 78 piedi)']),
  ('engagement_type', null, array['Ingaggio annuale','Ingaggio stagionale','A settimana','A chiamata','Trasferimenti','A contratto']),
  ('sought_role', null, array['Comandante','Deckhand','Hostess/Steward','Chef']),
  ('availability', null, array['Full time','Solo estate','Solo inverno','Flessibile']),
  ('tax_position', null, array['Ritenuta d''acconto','Partita IVA','A contratto']),
  ('logbook_role', null, array['Captain (Skipper)','Deckhand (Coskipper)','Crew','Hostess/Steward','Chef']),
  ('insurance_kind', null, array['Responsabilità civile skipper','Infortuni','Sanitaria','Altro']),
  ('experience_years', null, array['Nessuna esperienza','0-3 anni','4-5 anni','6-10 anni','+10 anni']),
  ('experience_context', null, array['Charter','Flotta','Vacanza organizzata','Yacht privato','Eventi','Crociera','Regata'])
) as v(list, grp, labels), unnest(v.labels) with ordinality as x(label, ord);

-- ───────── Catalogo dei titoli: gruppo, descrizione, ambito, validità in mesi, uso commerciale.
alter table public.title_catalog
  add column group_label text,
  add column description text,
  add column scope       text,
  add column commercial  boolean not null default false;

insert into public.title_catalog (code, name_it, name_en, category, issuer, for_skipper, for_crew, sort) values
  ('CREW_MGMT', 'Crew Management', 'Crew Management', 'other', 'Centri nautici riconosciuti', false, false, 67),
  ('PSS', 'Primo Soccorso Sanitario', 'Training certificate in medical First Aid', 'first_aid', 'Ministero della Salute', false, false, 34);
update public.title_catalog set issuer = 'Ministero della Salute' where code = 'FIRST_AID_MERC';

update public.title_catalog c set group_label = v.grp, scope = v.scope, validity_months = v.months, commercial = v.com, description = v.descr
from (values
  ('PATENTE_12M_VELA','Abilitazione al Comando','Diporto',120,false,'Conduzione di imbarcazioni a vela entro 12 miglia dalla costa'),
  ('PATENTE_12M_MOTORE','Abilitazione al Comando','Diporto',120,false,'Conduzione di imbarcazioni a motore entro 12 miglia dalla costa'),
  ('PATENTE_SL','Abilitazione al Comando','Diporto / Professionale',120,false,'Conduzione di imbarcazioni a vela e a motore senza limiti dalla costa'),
  ('PATENTE_SL_MOTORE','Abilitazione al Comando','Diporto / Professionale',120,false,'Conduzione di imbarcazioni a motore senza limiti dalla costa'),
  ('UFF_2CL','Abilitazione al Comando','Professionale',null,true,'Abilitazione professionale per il comando di unità da diporto commerciali'),
  ('YM_COASTAL','Abilitazione al Comando','Diporto / Professionale',null,true,'Certificato di competenza per navigazione costiera'),
  ('YM_OFFSHORE','Abilitazione al Comando','Diporto / Professionale',null,true,'Certificato per navigazione offshore fino a 150 miglia dalla costa'),
  ('YM_OCEAN','Abilitazione al Comando','Professionale',null,true,'Certificato per navigazione oceanica'),
  ('MCA_200','Abilitazione al Comando','Professionale',null,true,'Abilitazione al comando di navi fino a 200GT'),
  ('MCA_500','Abilitazione al Comando','Professionale',null,true,'Abilitazione al comando di navi fino a 500GT'),
  ('MCA_3000','Abilitazione al Comando','Professionale',null,true,'Abilitazione al comando di navi fino a 3000GT'),
  ('BLSD_FIRST_AID','Sicurezza','Diporto / Professionale',24,false,'Supporto vitale di base con uso del DAE per operatori laici; training teorico-pratico su RCP e defibrillazione'),
  ('FIRST_AID','Sicurezza','Professionale',24,false,'Primo soccorso a bordo'),
  ('ELEM_FIRST_AID','Sicurezza','Diporto / Professionale',null,false,'Modulo di primo soccorso all''interno dello STCW'),
  ('FIRST_AID_MERC','Sicurezza','Diporto / Professionale',60,false,null),
  ('PSS','Sicurezza','Diporto / Professionale',60,false,'Addestramento al primo soccorso sanitario a bordo di navi. Propedeutico al titolo di Ufficiale di 2ª classe del diporto'),
  ('FPFF','Sicurezza','Diporto / Professionale',60,false,'Corso parte del pacchetto STCW95'),
  ('PST','Sicurezza','Diporto / Professionale',60,false,'Corso parte del pacchetto STCW95'),
  ('PSSR','Sicurezza','Diporto / Professionale',null,false,'Corso parte del pacchetto STCW95'),
  ('STCW95','Sicurezza','Professionale',60,true,'Formazione base su sopravvivenza, antincendio, primo soccorso e sicurezza personale'),
  ('SRC','Comunicazione','Diporto / Professionale',null,false,'Uso radio VHF/DSC area GMDSS A1'),
  ('LRC','Comunicazione','Diporto / Professionale',null,false,'Uso radio MF/HF e satellitare per navigazioni estese'),
  ('GOC','Comunicazione','Professionale',null,false,'Certificazione completa per uso delle apparecchiature GMDSS'),
  ('ROC','Comunicazione','Professionale',null,false,'Operatore radio in area GMDSS A1'),
  ('RTF','Comunicazione','Diporto',null,false,'Uso di apparati radio di bordo non DSC di potenza limitata, su unità di piccola stazza'),
  ('ENG1','Visite Mediche','Professionale',24,true,'Certificato medico marittimo internazionale che attesta l''idoneità fisica al lavoro in mare'),
  ('ML5','Visite Mediche','Professionale',60,false,'Certificato medico UK per lavorare su imbarcazioni commerciali sotto i 24 metri'),
  ('METEO_RYA','Corso RYA','Diporto / Professionale',null,false,'Formazione avanzata in meteorologia e pianificazione delle rotte'),
  ('RYA_DIESEL','Corso RYA','Diporto / Professionale',null,false,'Gestione e manutenzione del motore diesel di bordo'),
  ('RYA_DIESEL_2','Corso RYA','Tecnico',null,false,'Corso tecnico di un giorno sulla manutenzione del motore diesel marino'),
  ('YM_SHOREBASED','Corso RYA',null,null,false,'Corso teorico propedeutico agli esami pratici Yachtmaster Coastal e Offshore'),
  ('METEO_WT','Meteo','Diporto / Professionale',null,false,'Master Class sull''analisi dei fenomeni meteorologici e sul meteo routing in crociera'),
  ('CREW_MGMT','Gestione personale','Professionale',null,true,'Gestione dell''equipaggio e delle risorse a bordo'),
  ('HELM','Gestione personale','Professionale',null,false,'Leadership, gestione del personale e fattore umano. Richiesto per Ufficiale di coperta e Comandante su yacht oltre 24 metri'),
  ('PPR','Gestione personale','Diporto / Professionale',null,false,'Corso RYA online richiesto per il commercial endorsement dei titoli RYA'),
  ('CHEF','Professionale',null,null,false,'Certificazione Chef di bordo'),
  ('CREW_ASSISTANT','Professionale',null,null,false,'Certificazione Crew Assistant'),
  ('FOOD_SAFETY_2','Professionale','Hospitality',36,false,'Igiene, conservazione, allergeni e HACCP di base per chi prepara e serve alimenti sugli yacht'),
  ('GENTE_DI_MARE','Professionale','Professionale',null,false,'Iscrizione all''albo professionale dei marittimi'),
  ('HACCP','Professionale',null,null,false,'Certificazione di igiene alimentare'),
  ('SHIPS_COOK','Professionale','Hospitality',null,false,'Certificato per cuochi su yacht e navi con 10 o più membri di equipaggio')
) as v(code, grp, scope, months, com, descr) where c.code = v.code;
update public.title_catalog set group_label = 'Altro' where group_label is null;

-- La scadenza non può venire prima del rilascio (messaggio chiaro, non un errore tecnico).
create or replace function private.check_title_dates() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.issued_on is not null and new.expires_on is not null and new.expires_on < new.issued_on then
    raise exception 'La data di scadenza viene prima della data di rilascio: controlla le due date.';
  end if;
  return new;
end $$;
create trigger person_title_dates before insert or update on public.person_title for each row execute function private.check_title_dates();
alter table public.identity_document add column issuer text, add column issued_on date;
alter table public.insurance add column issued_on date;
create trigger identity_document_dates before insert or update on public.identity_document for each row execute function private.check_title_dates();
create trigger insurance_dates before insert or update on public.insurance for each row execute function private.check_title_dates();

-- ───────── Curriculum: una riga per persona.
alter type public.skill_kind add value if not exists 'soft';
alter type public.skill_kind add value if not exists 'hobby';
alter type public.skill_kind add value if not exists 'sport';

create table public.person_profile (
  person_id        uuid primary key references public.person(id),
  description      text check (length(description) <= 3000),
  objective        text check (length(objective) <= 1500),
  smoker           boolean,
  engagement_types text[] not null default '{}',
  sought_roles     text[] not null default '{}',
  availability     text[] not null default '{}',
  tax_positions    text[] not null default '{}',
  min_daily_rate   integer check (min_daily_rate between 0 and 5000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create table public.reference_letter (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.person(id),
  title       text not null check (length(btrim(title)) between 1 and 160),
  issuer      text,
  issued_on   date check (issued_on <= current_date),
  file_id     uuid references public.file(id),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index reference_letter_person on public.reference_letter(person_id);
do $$
declare t text;
begin
  foreach t in array array['person_profile','reference_letter'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy %1$I_own_select on public.%1$I for select to authenticated
      using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin())$f$, t);
    execute format($f$create policy %1$I_own_insert on public.%1$I for insert to authenticated
      with check ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin())$f$, t);
    execute format($f$create policy %1$I_own_update on public.%1$I for update to authenticated
      using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin())
      with check (person_id = private.my_person_id() or private.is_admin())$f$, t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
    execute format('create trigger %I_audit_admin after insert or update or delete on public.%I for each row execute function private.audit_admin_edit()', t, t);
  end loop;
end $$;

-- ───────── Logbook: i campi del file stagionale di oggi.
alter table public.logbook_entry
  add column boat_model  text,
  add column loa_m       numeric(5,2) check (loa_m between 2 and 150),
  add column propulsion  text check (propulsion in ('sail','power')),
  add column night_hours numeric(6,1) check (night_hours >= 0),
  add column night_miles numeric(8,1) check (night_miles >= 0),
  add column is_tidal    boolean not null default false,
  add column role_label  text,
  add column notes       text;
