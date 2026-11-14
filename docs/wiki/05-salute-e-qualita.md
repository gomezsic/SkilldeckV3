# 05 · Salute e qualità

Obiettivo: accorgersi dei problemi prima degli utenti, e non perdere il controllo quando il progetto cresce. Quattro strumenti, ognuno con un compito preciso.

## 1. Controllo di salute (dentro l'app)

Area **Sistema** dell'amministratore. Funzione `system_health()`: 32 verifiche, ognuna dice quanti casi ha trovato e cosa fare. "Esegui e salva nello storico" lascia una riga in `health_run`, così si vede se la situazione migliora o peggiora.

| Area | Cosa cerca |
|---|---|
| Sicurezza | Tabelle senza protezione o senza regole; tabelle o funzioni raggiungibili senza accesso; funzioni privilegiate non blindate; file collegati alla persona sbagliata; elenco degli amministratori |
| Persone | Accessi senza scheda, schede senza accesso, doppioni per email, telefono, nome e data di nascita |
| Percorso | In percorso senza piano, più piani attivi, piani vuoti, Ready senza capacità, candidature ferme, colloqui non chiusi, promemoria in ritardo |
| Documenti | File registrati ma assenti, file in archivio non registrati, file che nessuno usa, titoli senza file, titoli doppi, verifiche in attesa, date incoerenti |
| Dati | Navigazioni sovrapposte, dati fiscali malformati, voci fuori elenco |
| Funzionamento | Errori aperti degli ultimi 7 giorni, email bloccate |

Quando si aggiunge una tabella o una regola, si aggiunge la verifica corrispondente.

## 2. Registro degli errori

Ogni guasto vero incontrato da un utente viene scritto da solo in `app_error`: cosa ha visto, il testo tecnico, la pagina, la versione, il dispositivo. Non contiene mai il contenuto dei moduli. Non registra i controlli sui dati ("la data è nel futuro") né la rete assente. L'amministratore lo legge in Sistema e segna gli errori come risolti.

## 3. Prove automatiche

`npm test` nella cartella `app` (22 prove al 14/11): dati fiscali e logbook. Girano a ogni pubblicazione: se una fallisce, il sito non si aggiorna. Insieme girano il controllo dei tipi e il controllo delle dipendenze con falle note.

Da aggiungere: fasce dei colloqui, regole di candidatura, e una serie ripetibile di prove delle regole di accesso sul database.

## 4. Revisione periodica con ruoli specializzati

Il controllo di salute trova ciò che si può contare. Non trova un difetto di logica o una schermata confusa: per quello serve una revisione ragionata. Si fa a ogni traguardo (non in continuo), con cinque ruoli, ognuno con la sua lista:

| Ruolo | Guarda | Strumenti |
|---|---|---|
| Sicurezza | Regole di accesso, permessi, funzioni privilegiate, segreti, archivio file | Controllo di Supabase, `system_health`, lettura delle migrazioni |
| Integrità dei dati | Orfani, doppioni, incoerenze, vincoli mancanti | `system_health`, interrogazioni mirate |
| Difetti | Registro errori, casi limite dei moduli, percorsi non provati | `app_error`, prove automatiche, prova in locale |
| Esperienza d'uso | Schermate contro i principi (una azione per schermata, messaggi chiari, telefono) | Lista di revisione del documento unico |
| Coerenza del progetto | Codice, database, wiki e documento unico dicono la stessa cosa | Bussola, tabella delle funzioni |

Ogni revisione finisce con un elenco: trovato, gravità, proposta di soluzione, e la Bussola aggiornata.

## Lista prima di ogni rilascio

1. Prove automatiche verdi.
2. Controllo di salute senza voci "da sistemare".
3. Controllo di sicurezza di Supabase senza novità.
4. Migrazione nel repository uguale a quella applicata.
5. Bussola e tabella delle funzioni aggiornate.

## Primo controllo eseguito (14/11/2026)

- **Trovato e corretto**: otto tabelle avevano il permesso di base anche per chi non ha fatto l'accesso. I dati erano comunque protetti dalle regole riga per riga, ma mancava la seconda serratura. Corretto con la migrazione 0015, che lo impedisce anche per le tabelle future.
- **Trovato e corretto**: mancavano gli indici sulle letture per persona.
- **Da fare dall'owner nel pannello Supabase**: accendere la protezione delle password compromesse.
- **Nessun dato orfano, nessun doppione, nessun file fuori posto.** Due titoli dichiarati senza file, sulle persone di prova.
