# 00 · Bussola

Aggiornata il **17 novembre 2026, ore 8:45**. Ultima migrazione: **0017**. Sito di collaudo: https://skilldeckpro-v3.web.app

## Dove siamo

SkillDeck V3 è la nuova piattaforma, costruita in parallelo a quella attuale (skilldeckpro.com, che resta in servizio e non si tocca). Il passaggio è previsto tra 6 e 7 mesi, in due tempi:

1. **Primo tempo: la persona.** Candidatura, colloquio, percorso fino a Ready, profilo completo, documenti, logbook. **È quello che stiamo costruendo.**
2. **Secondo tempo: il lavoro.** Ingaggi, lettere, bordo. Non iniziato.

Avanzamento del primo tempo, per blocchi:

| Blocco | Stato |
|---|---|
| Accesso (email e Google) e candidatura identica a quella di oggi | Costruito. Accesso Google provato dal vivo; candidatura provata sul database |
| Colloqui: date proposte, fissare, spostare, chiudere, fasce modificabili | Costruito, provato sul database |
| Percorso: accetta, piano, passi, coda "Pronti per Ready", conferma | Costruito. Accettazione provata dal vivo |
| Profilo completo: foto, curriculum, titoli, documenti, assicurazioni, logbook, fiscale | Costruito, provato in locale |
| Ambiente amministratore: cabina di regia, persone, impostazioni, sistema | Costruito. Cinque aree restano segnaposto |
| Note, decisioni, promemoria, messaggi sulla persona | Costruito, provato sul database |
| Salute del sistema: controllo, registro errori, prove automatiche | Costruito, provato sul database e in locale |
| Test (Skipper Test, Crew Test) | **Non iniziato** |
| Career (edizioni, lezioni, valutazioni, formatori) | **Non iniziato** |
| Email (modelli approvati, invii controllati, registro) | **Non iniziato**: manca la posta sul dominio |
| Migrazione dei dati dalla piattaforma attuale | **Non iniziata** |

**Novità del 17/11.** Il profilo completo ora sta in **My Skills**; la foto in alto lo apre da ogni pagina. **My Deck** è il mondo degli strumenti di viaggio (per ora segnaposto, secondo tempo). Lo stato "Registrato" ora si chiama **Wannabe** (migrazione 0017, solo i nomi). Le ventidue decisioni aperte sono tutte passate dall'owner: vedi `06-decisioni.md`.

## Cosa è fatto bene

- **La sicurezza sta nel database, non nell'app.** Ogni tabella ha la protezione riga per riga; lo stato della persona cambia solo tramite comandi; ogni comando scrive nel registro delle azioni. Il controllo di salute del 14/11 non trova nessuna falla aperta.
- **Niente si perde.** Persone, titoli e documenti si archiviano e si ripristinano. I file non si sovrascrivono.
- **Controlli di buon senso ovunque**, ripetuti nel modulo e nel database, con messaggi che dicono cosa correggere.
- **Elenchi modificabili** dall'amministratore senza toccare il codice.
- **Pubblicazione automatica** a ogni modifica, con prove automatiche prima.

## Cosa va sistemato

Debolezze note, in ordine di importanza.

1. **Quasi nulla è stato provato dal vivo da un utente vero.** È il rischio maggiore: finché l'owner non prova i moduli sul sito, i difetti di salvataggio restano nascosti. Il registro degli errori (area Sistema) ora li raccoglie da solo.
2. **Posta di prova di Supabase**: rifiuta i domini aziendali e ha un tetto orario. Blocca le registrazioni con email. Deciso il 17/11: Resend sul sottodominio dedicato `app.skilldeckpro.com`. Configurazione avviata, in attesa delle righe del dominio.
3. **Indirizzo del sito in Supabase**: impostato dall'owner il 14/11. Da confermare alla prima registrazione con email.
4. **Protezione delle password compromesse** spenta in Supabase (segnalata dal controllo di Supabase). Si accende dal pannello, lo fa l'owner.
6. **Le prove automatiche coprono solo due moduli** (dati fiscali e logbook). Mancano quelle sulle fasce dei colloqui e sulle schermate.
7. **Nessuna prova automatica del database.** Le regole di accesso sono state provate a mano, non c'è una serie ripetibile.
8. **I livelli di cucina e di competenza e i prefissi telefonici** sono ancora fissi nel codice.
9. **App Google in modalità Test**: entrano solo gli utenti di prova aggiunti dall'owner.

## Cosa manca per chiudere il profilo

- Email di promemoria delle scadenze (dipende dalla posta).
- Riconoscimento automatico del documento (tipo e date): deciso che si fa, dopo le prove dell'inserimento a mano. Progetto in cinque fasi nel documento unico.
- Lettere di referenza: rimandate dall'owner, restano presenti e facoltative.
- Richiesta di cancellazione del proprio account (arriva all'amministratore).
- Verifica in due passaggi per l'amministratore, prima dell'apertura.
- Simulazione utente ("guarda come questa persona").

## Cosa viene dopo

1. Posta: Resend su `app.skilldeckpro.com` (tre tappe, la chiave la inserisce l'owner). Sblocca le registrazioni con email.
2. Prove dal vivo dell'owner in cinque giri, e correzione di ciò che emerge. Poi piano email (sei regole già approvate).
3. Test: un solo motore per Skipper Test e Crew Test.
4. Career e area formazione.
5. Migrazione dei dati sani dalla piattaforma attuale, compreso lo storico 2026: 829 clienti, 50 ingaggi pubblicati con barche, 154 incarichi di tutti i ruoli con compenso pattuito, 853 partecipazioni. Niente lettere, bozze, annullati.
6. Secondo tempo.

## Scadenze esterne

- Nessuna aperta. L'esame WTest del 16 novembre 2026 sulla piattaforma attuale è passato.
