# SkillDeck V3

Prima di qualsiasi lavoro leggi `docs/wiki/00-bussola.md` (dove siamo) e `docs/wiki/07-come-si-lavora.md` (procedura e vincoli). L'indice è in `docs/wiki/README.md`.

Regole brevi:
- Rispondi all'owner in italiano, con parole semplici.
- Nella cartella `app`, prima di pubblicare: `npx tsc -b && npm test && npx vite build`.
- Ogni migrazione applicata ha il suo file in `supabase/migrations`; dopo ogni migrazione si esegue `select * from system_health()`.
- Prima di chiudere aggiorna la Bussola e la tabella in `docs/wiki/04-funzioni.md`.
- La piattaforma attuale (repository beskilled, Lovable, skilldeckpro.com) è in sola lettura.
