# 04 · Funzioni costruite

Per ogni funzione: dove sta nel codice e quanto è stata verificata (livelli spiegati nell'indice).

## Ingresso

| Funzione | Dove | Verifica |
|---|---|---|
| Pagine "Diventa skipper" e "Diventa crew" | `Landing.tsx` | Provato in locale |
| Modulo di candidatura Skipper e Crew, bozza salvata sul dispositivo | `Application.tsx`, `lib/application.ts` | Provato in locale; invio provato sul database |
| Accesso con email e password | `Access.tsx` | Dal vivo ha urtato i limiti della posta di prova |
| Accesso con Google | `Access.tsx`, `Application.tsx` | Provato dal vivo |
| Proposta di date per il colloquio (ora di Roma) | `lib/application.ts` | Provato in locale |

## Utente

| Funzione | Dove | Verifica |
|---|---|---|
| Today per stato, con la scheda del colloquio | `Today.tsx` | Provato in locale |
| My Deck: riepilogo, tre requisiti, dati personali | `MyDeck.tsx` | Modifica dati provata dal vivo |
| Foto del profilo con ritaglio | `ProfileExtras.tsx`, `CropDialog.tsx` | Solo compilato |
| Scheda certificazione: catalogo a gruppi, ente, numero, rilascio, scadenza calcolata, file | `TitleForm.tsx` | Provato in locale |
| Carica documento: foto alleggerita, ritaglio, rotazione | `components/ui.tsx`, `lib/image.ts` | Provato in locale |
| Documenti e assicurazioni con ente e rilascio | `MyDeck.tsx` | Provato in locale |
| Curriculum compatto a righe, modifica per riga | `Curriculum.tsx` | Provato in locale; lettura approvata dall'owner |
| Lettere di referenza | `ProfileExtras.tsx` | Provato in locale; da confermare con l'owner |
| Logbook: totali, scheda estesa, file della stagione Excel e CSV, sovrapposizioni | `Logbook.tsx`, `lib/logbook.ts` | Provato in locale e con prove automatiche |
| Dati fiscali completi con controlli | `ProfileExtras.tsx`, `lib/fiscal.ts` | Provato in locale e con prove automatiche |
| Scadenze: avviso da 90 giorni, urgente sotto i 30 | `MyDeck.tsx` | Provato in locale |
| Avviso di versione nuova | `UpdateNotice.tsx` | Solo compilato |

## Amministratore

| Funzione | Dove | Verifica |
|---|---|---|
| Cabina di regia: candidature, colloqui, promemoria, pronti per Ready, in percorso, scadenze, titoli da verificare | `ControlRoom.tsx` | Provato dal vivo nella prima versione |
| Persone: ricerca e scheda | `People.tsx`, `PersonSheet.tsx` | Provato dal vivo |
| Accetta o non accetta con nota di decisione; piano; passi; conferma Ready | `PersonSheet.tsx` | Accettazione provata dal vivo; il resto sul database |
| Colloquio: fissa, sposta, annulla, segna fatto con nota | `CandidacyPanel.tsx` | Provato sul database |
| Modifica delle risposte della candidatura | `CandidacyPanel.tsx` | Solo compilato |
| Note, promemoria, email e WhatsApp dal proprio programma | `PersonNotes.tsx` | Provato sul database |
| Compilare My Deck al posto della persona; archivia e ripristina | `MyDeck.tsx` | Provato sul database |
| Impostazioni: 20 elenchi e catalogo dei 41 titoli | `Settings.tsx` | Solo compilato |
| Fasce dei colloqui | `InterviewSettings.tsx` | Provato sul database |
| Sistema: controllo di salute, registro errori, registro azioni | `System.tsx` | Controllo provato sul database |

## Aree dell'amministratore ancora segnaposto

Formazione, Ingaggi, A bordo, Comunicazioni, Contenuti, Commerciale.
