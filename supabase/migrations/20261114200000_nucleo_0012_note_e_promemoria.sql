-- 0012 · Note dell'amministratore sulla persona, promemoria e traccia dei messaggi scritti.
-- Tutto riservato all'amministratore: la persona non legge mai queste righe.
create table public.person_note (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.person(id),
  kind        text not null check (kind in ('note','interview','decision','email','whatsapp','memo')),
  subject     text check (subject is null or length(subject) <= 200),
  body        text not null check (length(btrim(body)) between 1 and 8000),
  due_on      date,
  done_at     timestamptz,
  created_by  uuid references public.person(id) default private.my_person_id(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (kind = 'memo' or (due_on is null and done_at is null))
);
create index person_note_person on public.person_note(person_id, created_at desc);
create index person_note_memo_open on public.person_note(due_on) where kind = 'memo' and done_at is null;
alter table public.person_note enable row level security;
create policy person_note_admin on public.person_note for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, insert, update, delete on public.person_note to authenticated;
create trigger person_note_touch before update on public.person_note
  for each row execute function private.touch_updated_at();
create trigger person_note_audit_admin after insert or update or delete on public.person_note
  for each row execute function private.audit_admin_edit();
