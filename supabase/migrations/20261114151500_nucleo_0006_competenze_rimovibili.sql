-- SkillDeck V3 — nucleo: una competenza o una lingua inserita per errore si può togliere.
-- È l'unica cancellazione ammessa all'interessato: sono etichette del profilo, non documenti né storia.
create policy person_skill_own_delete on public.person_skill for delete to authenticated
  using ((person_id = private.my_person_id() and private.is_active_me()) or private.is_admin());
grant delete on public.person_skill to authenticated;
