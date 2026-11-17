# 02 · Architettura

## Il triangolo

```
GitHub gomezsic/SkilldeckV3  ──push su main──▶  GitHub Actions  ──▶  Firebase Hosting
        (codice e migrazioni)                  prove + compilazione      https://skilldeckpro-v3.web.app
                                                                                 │
                                                                                 ▼
                                                              Supabase "skilldeck-v3-collaudo"
                                                              (database, accessi, archivio file) · UE
```

- **Codice**: React 19, Vite 8, TypeScript, Tailwind 4, supabase-js. Nessun server nostro: l'app parla direttamente con Supabase e le regole stanno nel database.
- **Pubblicazione**: ogni push su `main` esegue le prove automatiche, compila e pubblica. Se una prova fallisce non si pubblica.
- **Database**: Supabase, progetto di collaudo `wfrkxxkrildyacwxoilm`. Le migrazioni stanno in `supabase/migrations/` e si applicano dal connettore Supabase.
- **File degli utenti**: archivio privato `documenti`, una cartella per persona.
- **Accessi**: email e password, oppure Google (in modalità Test).

## Mappa dei file

```
app/src/
  App.tsx                 rotte (con #), sessione, scelta fra utente e amministratore
  main.tsx                avvio, avviso di versione nuova, cattura degli errori
  lib/
    supabase.ts           collegamento
    deck.ts               lettura e scrittura del profilo (My Skills)
    application.ts        candidatura e fasce dei colloqui (ora di Roma)
    lists.ts              elenchi modificabili e catalogo dei titoli
    logbook.ts            lettura del file stagionale (Excel e CSV), controlli, sovrapposizioni
    fiscal.ts             controlli su codice fiscale, partita IVA, IBAN
    image.ts              alleggerimento e ritaglio delle foto
    friendly.ts           ogni errore diventa un messaggio chiaro; i guasti veri vanno nel registro
    errors.ts             segnalazione degli errori al database
    labels.ts, types.ts, demo.ts
  components/             ui.tsx (mattoni comuni), CropDialog, UpdateNotice
  screens/
    Landing, Application, Access           ingresso e candidatura
    Today, MyDeck, Curriculum, Logbook, TitleForm, ProfileExtras, DeckForms    utente
    AdminShell, ControlRoom, People, PersonSheet, CandidacyPanel, PersonNotes,
    InterviewSettings, Settings, System    amministratore
supabase/migrations/      una migrazione per passo, numerate
docs/wiki/                questa wiki
.github/workflows/        pubblicazione e anteprime
```

## Modalità di esempio

`?demo=registrato|percorso|ready|admin` mostra l'app con persone inventate, senza database. Serve per guardare la grafica. In locale `&edit` accende anche i moduli.

## Cosa non c'è ancora

Nessuna funzione lato server oltre al database (niente invio email, niente lettura automatica dei documenti). Quando serviranno, saranno funzioni di Supabase.
