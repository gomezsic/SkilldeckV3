-- 0016: la coda "Pronti per Ready" non mostra le persone archiviate.
create or replace view public.ready_queue with (security_invoker = true) as
 select pl.id as plan_id, pl.person_id, pl.goal_capability, pl.assigned_at,
    max(s.done_at) filter (where s.kind <> 'ready_confirmation'::step_kind) as ready_since
   from path_plan pl
     join path_step s on s.plan_id = pl.id
     join person p on p.id = pl.person_id and p.archived_at is null and (p.status = any (array['in_path'::person_status, 'ready'::person_status]))
  where pl.status = 'active'::plan_status
  group by pl.id
 having bool_and(s.status = any (array['done'::step_status, 'not_required'::step_status])) filter (where s.kind <> 'ready_confirmation'::step_kind) and bool_or(s.kind = 'ready_confirmation'::step_kind and (s.status = any (array['todo'::step_status, 'in_progress'::step_status])));
