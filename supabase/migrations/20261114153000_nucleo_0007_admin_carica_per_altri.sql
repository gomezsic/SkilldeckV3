-- SkillDeck V3 — nucleo: l'amministratore può caricare un file nella cartella di qualunque persona
-- (per esempio un titolo ricevuto via email). Resta vietato sovrascrivere o cancellare.
create policy documenti_admin_carica_per_chiunque on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti' and private.is_admin());
