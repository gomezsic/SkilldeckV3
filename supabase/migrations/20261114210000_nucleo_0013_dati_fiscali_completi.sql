-- 0013 · Dati fiscali completi, come nella piattaforma di oggi: luogo di nascita, "non ho il codice fiscale",
-- intestazione della fattura (ragione sociale, PEC, codice SDI) e indirizzo di fatturazione.
alter table public.tax_profile
  add column birth_place    text,
  add column no_tax_code    boolean not null default false,
  add column company_name   text,
  add column pec            text check (pec is null or pec ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  add column sdi_code       text check (sdi_code is null or sdi_code ~ '^[A-Z0-9]{7}$'),
  add column billing_same   boolean not null default true;
