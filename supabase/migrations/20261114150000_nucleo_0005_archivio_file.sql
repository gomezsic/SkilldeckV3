-- SkillDeck V3 — nucleo: archivio privato dei file (titoli, documenti, assicurazioni).
-- Ogni persona carica solo nella propria cartella (il nome della cartella è il suo id) e legge solo i propri file;
-- l'amministratore legge tutto. Nessuno sovrascrive o cancella: un rinnovo è un file nuovo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documenti', 'documenti', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy documenti_carico_nella_mia_cartella on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti'
              and (storage.foldername(name))[1] = private.my_person_id()::text
              and private.is_active_me());

create policy documenti_leggo_i_miei on storage.objects for select to authenticated
  using (bucket_id = 'documenti'
         and (private.is_admin()
              or ((storage.foldername(name))[1] = private.my_person_id()::text and private.is_active_me())));
