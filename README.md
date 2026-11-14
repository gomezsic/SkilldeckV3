# SkillDeck V3

Nuova piattaforma SkillDeck. Si costruisce in parallelo a quella attuale, che resta in uso.

## Stato

Fase: nucleo (persona, percorso, profilo, documenti). Solo database, nessuna applicazione ancora.

- `supabase/migrations/` — schema del database, nell'ordine in cui si applica.
  - `…_nucleo_0001_tabelle_e_protezioni.sql` — tabelle, elenchi chiusi, regole di accesso, coda "Pronti per Ready".
  - `…_nucleo_0002_comandi.sql` — comandi dell'amministratore (accetta candidatura, conferma Ready, sospendi, escludi, verifica titolo…).

## Regole

- I permessi stanno nel database: ogni tabella nasce chiusa e si apre solo con una regola esplicita.
- Stato, famiglia, capacità, piano di percorso, passi e sospensione si cambiano solo con i comandi.
- Nulla si cancella. Ogni comando lascia una riga nel registro delle azioni.
- Nessun dato reale negli ambienti di prova. Nessuna chiave o password in questo repository.

## Ambienti

- Collaudo: progetto Supabase `skilldeck-v3-collaudo` (Europa). Le migrazioni di questa cartella sono applicate lì.
- Produzione: non ancora creata.

## Applicazione (cartella `app/`)

React, Vite e Tailwind. Per vederla in locale:

```
cd app
npm install
npm run dev
```

Poi apri l'indirizzo indicato. Con `?demo=registrato`, `?demo=percorso` o `?demo=ready` vedi My Deck con persone inventate, senza accedere. Il file `app/.env` punta al database di collaudo e contiene solo valori pubblici.
