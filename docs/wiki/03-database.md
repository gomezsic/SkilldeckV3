# 03 · Database

Supabase, progetto di collaudo `skilldeck-v3-collaudo`. Stato al 14/11/2026: **28 tabelle** nello schema `public`, 2 nello schema `private`, 30 funzioni, 41 titoli a catalogo, 20 elenchi modificabili.

## Modello di sicurezza

1. **Ogni tabella ha la protezione riga per riga.** Regola tipo: "leggo e scrivo le righe con la mia persona, se sono attivo; l'amministratore vede tutto".
2. **Chi non ha fatto l'accesso** legge solo `option_list` e può chiamare solo `application_options()` e `log_error()`.
3. **Chi è amministratore** sta in `private.admin_user`, una tabella che l'applicazione non può leggere né scrivere. Il ruolo non è mai nel profilo.
4. **I cambi di stato passano solo dai comandi** (`cmd_…`): funzioni che controllano di essere chiamate da un amministratore e scrivono nel registro delle azioni. Un trigger impedisce all'interessato di cambiarsi stato o famiglia.
5. **Le funzioni privilegiate** hanno tutte il percorso di ricerca vuoto.
6. **File**: ognuno carica solo nella propria cartella e legge solo i propri; l'amministratore legge tutto. Nessuno sovrascrive o cancella.
7. **Controlli di buon senso** nei trigger `check_plausible` e `check_title_dates`: valgono per tutti, amministratore compreso.

## Tabelle

| Gruppo | Tabelle |
|---|---|
| Persona | `person`, `person_preferences`, `person_profile` (curriculum), `person_skill` (lingue, zone, competenze, hobby, sport), `tax_profile`, `person_role`, `person_status_history` |
| Candidatura e colloquio | `candidacy`, `interview_request`, `interview_settings` |
| Percorso | `path_plan`, `path_step`, `person_capability`, vista `ready_queue`, `private.assignment_hold` |
| Titoli e documenti | `title_catalog`, `title_equivalence`, `person_title`, `person_title_history`, `identity_document`, `insurance`, `reference_letter`, `file` |
| Navigazione | `logbook_entry` |
| Amministrazione | `person_note` (note, decisioni, promemoria, messaggi), `option_list` (elenchi), `private.admin_user` |
| Registri | `action_log`, `email_log`, `app_error`, `health_run` |

## Funzioni

- **Per l'utente**: `submit_application`, `my_interview`, `compliance`, `is_compliant`, `expiring`, `interview_busy`, `application_options`, `log_error`. `register_me` è la registrazione vecchia, non più usata dall'app.
- **Comandi dell'amministratore**: `cmd_accept_application`, `cmd_reject_application`, `cmd_open_plan`, `cmd_update_step`, `cmd_confirm_ready`, `cmd_direct_ready`, `cmd_grant_capability`, `cmd_revoke_capability`, `cmd_hold_start`, `cmd_hold_end`, `cmd_exclude`, `cmd_verify_title`, `cmd_reject_title`, `cmd_schedule_interview`, `cmd_complete_interview`, `cmd_cancel_interview`, `cmd_archive_row`, `cmd_delete_row`, `cmd_run_health`, `admin_list_holds`, `system_health`.

## Migrazioni

| N. | Contenuto |
|---|---|
| 0001 | Tabelle del nucleo, protezioni, trigger, coda Ready |
| 0002 | Comandi dell'amministratore |
| 0003 | Catalogo titoli, equivalenze, "in regola", scadenze |
| 0004 | Registrazione |
| 0005 | Archivio privato dei file |
| 0006 | Competenze rimovibili |
| 0007 | L'amministratore carica file per altri |
| 0008 | Modifica, archivio ed eliminazione da amministratore; controlli di buon senso; registro delle modifiche |
| 0009 | Candidatura e colloqui |
| 0010 | Opzioni della candidatura per chi non ha ancora l'accesso |
| 0011 | Profilo completo: elenchi, catalogo esteso, curriculum, referenze, logbook esteso |
| 0012 | Note, decisioni e promemoria sulla persona |
| 0013 | Dati fiscali completi |
| 0014 | Elenchi della candidatura Crew |
| 0015 | Salute del sistema: permessi più stretti, indici, registro errori, controllo di salute |
| 0016 | La coda "Pronti per Ready" esclude le persone archiviate |
| 0017 | Il primo stato si legge "Wannabe": aggiornati i tre messaggi dei comandi (il valore resta `registered`) |

Regole per le migrazioni: piccole, solo in avanti, una per passo; il file nel repository e ciò che è applicato devono coincidere; dopo ogni migrazione si esegue il controllo di salute.

## Cosa manca nel database

Test e domande, Career (edizioni, partecipazioni, valutazioni), modelli email e campagne, organizzazioni armatrici, barche, ingaggi, lettere, clienti.
